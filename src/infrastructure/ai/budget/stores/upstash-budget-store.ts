import { Redis } from "@upstash/redis";
import {
  AIBudgetExceededError,
  AIIdempotencyConflictError,
  AIProviderError,
} from "../../providers/errors.js";
import type {
  AIModelCall,
  AIMonthlyBudget,
  BudgetReservation,
  BudgetReservationRequest,
  ProjectAIUsageSnapshot,
  ProjectCostLedger,
} from "../../types.js";
import { getBudgetStatus } from "../budget-policy.js";
import { createLedger, type BudgetStore } from "../budget-tracker.js";
import { microUsdToUsd, usdToMicroUsd } from "../money.js";

const NS = "picadesigner:ai";
const reservationsIndex = `${NS}:reservations`;
const projectKey = (id: string) => `${NS}:project:${id}`,
  callsKey = (id: string) => `${projectKey(id)}:calls`,
  stageKey = (id: string, stage: string) => `${projectKey(id)}:stage:${stage}`,
  monthKey = (month: string) => `${NS}:month:${month}`,
  reservationKey = (id: string) => `${NS}:reservation:${id}`,
  operationKey = (id: string) => `${NS}:operation:${id}`;
const RESERVE_LUA = `
local expired=redis.call('ZRANGEBYSCORE',KEYS[5],'-inf',ARGV[12]);for _,rk in ipairs(expired) do local old=redis.call('GET',rk);if old then local x=cjson.decode(old);if x.status=='reserved' or x.status=='unknown_provider_outcome' then local pk=ARGV[13]..':project:'..x.projectId;local mk=ARGV[13]..':month:'..x.month;local sk=pk..':stage:'..x.stage;redis.call('HINCRBY',pk,'reserved',-tonumber(x.estimatedMicroUsd));redis.call('HINCRBY',mk,'reserved',-tonumber(x.estimatedMicroUsd));redis.call('HINCRBY',sk,'reserved',-tonumber(x.estimatedMicroUsd));x.status='expired';redis.call('SET',rk,cjson.encode(x),'EX',3600);if x.operationId then redis.call('DEL',ARGV[13]..':operation:'..x.operationId) end end end;redis.call('ZREM',KEYS[5],rk) end
local existing=ARGV[11]~='' and redis.call('GET',ARGV[11]) or false
if existing then return {'duplicate',existing} end
local ps=tonumber(redis.call('HGET',KEYS[1],'spent') or '0');local pr=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0')
local ms=tonumber(redis.call('HGET',KEYS[2],'spent') or '0');local mr=tonumber(redis.call('HGET',KEYS[2],'reserved') or '0')
local ss=tonumber(redis.call('HGET',KEYS[3],'spent') or '0');local sr=tonumber(redis.call('HGET',KEYS[3],'reserved') or '0');local amount=tonumber(ARGV[1])
if ps+pr+amount>tonumber(ARGV[2]) then return {'project'} end;if ms+mr+amount>tonumber(ARGV[3]) then return {'month'} end
if ARGV[4]~='' and ss+sr+amount>tonumber(ARGV[4]) then return {'stage'} end
redis.call('HINCRBY',KEYS[1],'reserved',amount);redis.call('HSETNX',KEYS[1],'startedAt',ARGV[7]);redis.call('HSET',KEYS[1],'updatedAt',ARGV[7])
redis.call('HINCRBY',KEYS[2],'reserved',amount);redis.call('HINCRBY',KEYS[3],'reserved',amount)
local monthProjectAdded=redis.call('SADD',KEYS[2]..':projects',ARGV[8]);if monthProjectAdded==1 then redis.call('HINCRBY',KEYS[2],'projectCount',1) end;redis.call('EXPIRE',KEYS[2]..':projects',46656000)
redis.call('SET',KEYS[4],ARGV[10],'EX',7776000);if ARGV[11]~='' then redis.call('SET',ARGV[11],ARGV[5],'EX',7776000) end
redis.call('ZADD',KEYS[5],ARGV[12],KEYS[4])
redis.call('EXPIRE',KEYS[1],7776000);redis.call('EXPIRE',KEYS[3],7776000);redis.call('EXPIRE',KEYS[2],46656000)
return {'reserved',ARGV[5]}`;
const COMMIT_LUA = `
local raw=redis.call('GET',KEYS[4]);if not raw then return {'missing'} end;local r=cjson.decode(raw);if r.status~='reserved' then return {'invalid'} end
local reserved=tonumber(r.estimatedMicroUsd);local actual=tonumber(ARGV[1]);redis.call('HINCRBY',KEYS[1],'reserved',-reserved);redis.call('HINCRBY',KEYS[2],'reserved',-reserved);redis.call('HINCRBY',KEYS[3],'reserved',-reserved)
redis.call('HINCRBY',KEYS[1],'spent',actual);redis.call('HINCRBY',KEYS[2],'spent',actual);redis.call('HINCRBY',KEYS[3],'spent',actual);redis.call('HSET',KEYS[1],'updatedAt',ARGV[2]);redis.call('RPUSH',KEYS[5],ARGV[3])
r.status='committed';redis.call('SET',KEYS[4],cjson.encode(r),'EX',7776000);redis.call('EXPIRE',KEYS[5],7776000);redis.call('ZREM',KEYS[6],KEYS[4]);return {'committed'}`;
const RELEASE_LUA = `local raw=redis.call('GET',KEYS[4]);if not raw then return 0 end;local r=cjson.decode(raw);if r.status~='reserved' then return 0 end;local a=tonumber(r.estimatedMicroUsd);redis.call('HINCRBY',KEYS[1],'reserved',-a);redis.call('HINCRBY',KEYS[2],'reserved',-a);redis.call('HINCRBY',KEYS[3],'reserved',-a);r.status=ARGV[1];redis.call('SET',KEYS[4],cjson.encode(r),'EX',3600);redis.call('ZREM',KEYS[5],KEYS[4]);if ARGV[2]~='' then redis.call('DEL',ARGV[2]) end;return 1`;
const UNKNOWN_LUA = `local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);if r.status~='reserved' then return 0 end;r.status='unknown_provider_outcome';redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1`;
type AtomicRedis = Omit<Redis, "eval"> & {
  eval<T>(script: string, keys: string[], args: string[]): Promise<T>;
};

export class UpstashBudgetStore implements BudgetStore {
  readonly kind = "durable" as const;
  readonly atomicReservations = true;
  constructor(private readonly redis: AtomicRedis) {}
  static fromEnv(env: NodeJS.ProcessEnv = process.env) {
    const pair =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? {
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
          }
        : env.KV_REST_API_URL && env.KV_REST_API_TOKEN
          ? { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN }
          : undefined;
    if (!pair) return undefined;
    return new UpstashBudgetStore(new Redis(pair) as AtomicRedis);
  }
  private safe = async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (
        error instanceof Error &&
        /^AI (project|month|stage) budget reservation rejected\.$/.test(
          error.message,
        )
      )
        throw new AIBudgetExceededError(error.message);
      throw new AIProviderError(
        "AI budget service temporarily unavailable.",
        error,
      );
    }
  };
  async getProject(projectId: string) {
    return this.safe(async () => {
      const [hash, rawCalls] = await Promise.all([
        this.redis.hgetall<Record<string, string | number>>(
          projectKey(projectId),
        ),
        this.redis.lrange<string>(callsKey(projectId), 0, -1),
      ]);
      if (!hash || hash.spent === undefined) return undefined;
      const modelCalls = rawCalls.map((value) =>
        typeof value === "string"
          ? (JSON.parse(value) as AIModelCall)
          : (value as unknown as AIModelCall),
      );
      return {
        projectId,
        startedAt: String(hash.startedAt ?? new Date().toISOString()),
        modelCalls,
        inputTokens: modelCalls.reduce((s, c) => s + c.inputTokens, 0),
        cachedInputTokens: modelCalls.reduce(
          (s, c) => s + c.cachedInputTokens,
          0,
        ),
        cacheWriteTokens: modelCalls.reduce(
          (s, c) => s + c.cacheWriteTokens,
          0,
        ),
        outputTokens: modelCalls.reduce((s, c) => s + c.outputTokens, 0),
        repairAttempts: modelCalls.filter((c) => c.repairAttempt).length,
        totalCostUsd: microUsdToUsd(Number(hash.spent ?? 0)),
      };
    });
  }
  async saveProject(ledger: ProjectCostLedger) {
    await this.safe(async () => {
      const pipeline = this.redis.pipeline();
      pipeline.hset(projectKey(ledger.projectId), {
        spent: usdToMicroUsd(ledger.totalCostUsd),
        reserved: 0,
        startedAt: ledger.startedAt,
        updatedAt: new Date().toISOString(),
      });
      pipeline.del(callsKey(ledger.projectId));
      for (const call of ledger.modelCalls)
        pipeline.rpush(callsKey(ledger.projectId), JSON.stringify(call));
      pipeline.expire(projectKey(ledger.projectId), 7776000);
      pipeline.expire(callsKey(ledger.projectId), 7776000);
      await pipeline.exec();
    });
  }
  async getMonth(month: string, limitUsd: number): Promise<AIMonthlyBudget> {
    return this.safe(async () => {
      const hash = await this.redis.hgetall<Record<string, string | number>>(
        monthKey(month),
      );
      const spentUsd = microUsdToUsd(Number(hash?.spent ?? 0));
      return {
        month,
        limitUsd,
        spentUsd,
        remainingUsd: Math.max(0, limitUsd - spentUsd),
        projectCount: Number(hash?.projectCount ?? 0),
      };
    });
  }
  async reserve(input: BudgetReservationRequest) {
    return this.safe(async () => {
      const reservationId = crypto.randomUUID(),
        createdAt = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() + input.ttlSeconds * 1000,
      ).toISOString();
      const reservation: BudgetReservation = {
        reservationId,
        operationId: input.operationId,
        projectId: input.projectId,
        month: input.month,
        stage: input.stage,
        estimatedMicroUsd: input.estimatedMicroUsd,
        createdAt,
        expiresAt,
        status: "reserved",
      };
      const op = input.operationId ? operationKey(input.operationId) : "";
      const result = await this.redis.eval<[string, string?]>(
        RESERVE_LUA,
        [
          projectKey(input.projectId),
          monthKey(input.month),
          stageKey(input.projectId, input.stage),
          reservationKey(reservationId),
          reservationsIndex,
        ],
        [
          String(input.estimatedMicroUsd),
          String(input.projectLimitMicroUsd),
          String(input.monthlyLimitMicroUsd),
          input.stageLimitMicroUsd === undefined
            ? ""
            : String(input.stageLimitMicroUsd),
          reservationId,
          String(input.ttlSeconds),
          createdAt,
          input.projectId,
          input.stage,
          JSON.stringify(reservation),
          op,
          String(Date.parse(expiresAt)),
          NS,
        ],
      );
      if (result[0] === "duplicate")
        throw new AIIdempotencyConflictError(
          "An identical AI operation is already in progress or completed.",
        );
      if (result[0] !== "reserved")
        throw new Error(`AI ${result[0]} budget reservation rejected.`);
      return reservation;
    });
  }
  async commit(reservationId: string, call: AIModelCall) {
    return this.safe(async () => {
      const raw = await this.redis.get<string>(reservationKey(reservationId));
      if (!raw) throw new Error("Budget reservation is not committable.");
      const reservation =
        typeof raw === "string"
          ? (JSON.parse(raw) as BudgetReservation)
          : (raw as unknown as BudgetReservation);
      const actual = usdToMicroUsd(call.costUsd);
      const committed = {
        ...call,
        stage: reservation.stage,
        operationId: reservation.operationId,
        budgetOverrun: actual > reservation.estimatedMicroUsd,
        occurredAt: call.occurredAt ?? new Date().toISOString(),
      };
      const result = await this.redis.eval<[string]>(
        COMMIT_LUA,
        [
          projectKey(reservation.projectId),
          monthKey(reservation.month),
          stageKey(reservation.projectId, reservation.stage),
          reservationKey(reservationId),
          callsKey(reservation.projectId),
          reservationsIndex,
        ],
        [String(actual), committed.occurredAt, JSON.stringify(committed)],
      );
      if (result[0] !== "committed")
        throw new Error("Budget reservation commit failed.");
      return (await this.getProject(reservation.projectId))!;
    });
  }
  private async finish(reservationId: string, status: "released") {
    await this.safe(async () => {
      const raw = await this.redis.get<string>(reservationKey(reservationId));
      if (!raw) return;
      const reservation =
        typeof raw === "string"
          ? (JSON.parse(raw) as BudgetReservation)
          : (raw as unknown as BudgetReservation);
      await this.redis.eval(
        RELEASE_LUA,
        [
          projectKey(reservation.projectId),
          monthKey(reservation.month),
          stageKey(reservation.projectId, reservation.stage),
          reservationKey(reservationId),
          reservationsIndex,
        ],
        [
          status,
          reservation.operationId ? operationKey(reservation.operationId) : "",
        ],
      );
    });
  }
  async release(id: string) {
    await this.finish(id, "released");
  }
  async resolveUnknown(id: string) {
    await this.safe(async () => {
      await this.redis.eval(UNKNOWN_LUA, [reservationKey(id)], []);
    });
  }
  async getUsageSnapshot(
    projectId: string,
    month: string,
    projectLimitUsd: number,
    monthlyLimitUsd: number,
  ): Promise<ProjectAIUsageSnapshot> {
    return this.safe(async () => {
      const [ledger, project, monthly] = await Promise.all([
        this.getProject(projectId),
        this.redis.hgetall<Record<string, string | number>>(
          projectKey(projectId),
        ),
        this.redis.hgetall<Record<string, string | number>>(monthKey(month)),
      ]);
      const spentUsd = ledger?.totalCostUsd ?? 0,
        reservedUsd = microUsdToUsd(Number(project?.reserved ?? 0)),
        monthlySpentUsd = microUsdToUsd(Number(monthly?.spent ?? 0)),
        monthlyReservedUsd = microUsdToUsd(Number(monthly?.reserved ?? 0));
      const stages: ProjectAIUsageSnapshot["stages"] = {};
      for (const stage of [
        "visual_forensics",
        "brand_intelligence",
        "creative_direction",
        "design_spec",
        "senior_critic",
        "image_generation",
        "layout_intelligence",
        "other",
      ] as const) {
        const value = await this.redis.hgetall<Record<string, string | number>>(
          stageKey(projectId, stage),
        );
        if (value && (Number(value.spent) || Number(value.reserved)))
          stages[stage] = {
            spentUsd: microUsdToUsd(Number(value.spent ?? 0)),
            reservedUsd: microUsdToUsd(Number(value.reserved ?? 0)),
          };
      }
      return {
        projectId,
        spentUsd,
        reservedUsd,
        remainingUsd: Math.max(0, projectLimitUsd - spentUsd - reservedUsd),
        monthlySpentUsd,
        monthlyReservedUsd,
        monthlyRemainingUsd: Math.max(
          0,
          monthlyLimitUsd - monthlySpentUsd - monthlyReservedUsd,
        ),
        stages,
        calls: ledger?.modelCalls ?? [],
        status: getBudgetStatus(spentUsd + reservedUsd, projectLimitUsd),
      };
    });
  }
  async health() {
    try {
      await this.redis.ping();
      return {
        status: "ok" as const,
        store: "durable" as const,
        atomicReservations: true,
      };
    } catch {
      return {
        status: "degraded" as const,
        store: "durable" as const,
        atomicReservations: true,
      };
    }
  }
}
