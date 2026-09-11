import {
  AIBudgetExceededError,
  AIIdempotencyConflictError,
} from "../../providers/errors.js";
import type {
  AIModelCall,
  AIOperationState,
  AIOperationResult,
  AIStage,
  AIMonthlyBudget,
  BudgetReservation,
  BudgetReservationRequest,
  ProjectAIUsageSnapshot,
  ProjectCostLedger,
} from "../../types.js";
import { getBudgetStatus } from "../budget-policy.js";
import {
  appendModelCall,
  createLedger,
  type BudgetStore,
} from "../budget-tracker.js";
import { microUsdToUsd, usdToMicroUsd } from "../money.js";

export class InMemoryBudgetStore implements BudgetStore {
  readonly kind = "memory" as const;
  readonly atomicReservations = true;
  private readonly projects = new Map<string, ProjectCostLedger>();
  private readonly reservations = new Map<string, BudgetReservation>();
  private readonly operations = new Map<string, string>();
  private readonly operationResults = new Map<string, AIOperationResult>();
  constructor(private readonly now: () => number = () => Date.now()) {}
  private expire() {
    const instant = this.now();
    for (const reservation of this.reservations.values())
      if (
        (reservation.status === "reserved" ||
          reservation.status === "unknown_provider_outcome") &&
        Date.parse(reservation.expiresAt) <= instant
      ) {
        reservation.status = "expired";
        if (reservation.operationId)
          this.operations.delete(reservation.operationId);
      }
  }
  async getProject(projectId: string) {
    const value = this.projects.get(projectId);
    return value ? structuredClone(value) : undefined;
  }
  async saveProject(ledger: ProjectCostLedger) {
    this.projects.set(ledger.projectId, structuredClone(ledger));
  }
  private monthSpent(month: string) {
    return [...this.projects.values()].reduce((sum, ledger) => {
      const calls = ledger.modelCalls.filter((call) =>
        (call.occurredAt ?? ledger.startedAt).startsWith(month),
      );
      return (
        sum +
        (calls.length
          ? calls.reduce((cost, call) => cost + call.costUsd, 0)
          : ledger.startedAt.startsWith(month)
            ? ledger.totalCostUsd
            : 0)
      );
    }, 0);
  }
  private reserved(projectId?: string, month?: string, stage?: AIStage) {
    this.expire();
    return [...this.reservations.values()]
      .filter(
        (item) =>
          (item.status === "reserved" ||
            item.status === "unknown_provider_outcome") &&
          (!projectId || item.projectId === projectId) &&
          (!month || item.month === month) &&
          (!stage || item.stage === stage),
      )
      .reduce((sum, item) => sum + item.estimatedMicroUsd, 0);
  }
  async getMonth(month: string, limitUsd: number): Promise<AIMonthlyBudget> {
    const spentUsd = this.monthSpent(month);
    return {
      month,
      limitUsd,
      spentUsd,
      remainingUsd: Math.max(0, limitUsd - spentUsd),
      projectCount: [...this.projects.values()].filter((item) =>
        item.startedAt.startsWith(month),
      ).length,
    };
  }
  async reserve(input: BudgetReservationRequest): Promise<BudgetReservation> {
    this.expire();
    if (input.operationId && this.operations.has(input.operationId))
      throw new AIIdempotencyConflictError(
        "An identical AI operation is already in progress or completed.",
      );
    const ledger =
      this.projects.get(input.projectId) ??
      createLedger(input.projectId, new Date(this.now()).toISOString());
    const spent = usdToMicroUsd(ledger.totalCostUsd);
    const projectReserved = this.reserved(input.projectId);
    const monthlySpent = usdToMicroUsd(this.monthSpent(input.month));
    const monthlyReserved = this.reserved(undefined, input.month);
    const stageSpent = usdToMicroUsd(
      ledger.modelCalls
        .filter((call) => call.stage === input.stage)
        .reduce((sum, call) => sum + call.costUsd, 0),
    );
    const stageReserved = this.reserved(
      input.projectId,
      undefined,
      input.stage,
    );
    if (
      spent + projectReserved + input.estimatedMicroUsd >
      input.projectLimitMicroUsd
    )
      throw new AIBudgetExceededError(
        "AI call blocked: project budget reservation would exceed its limit.",
      );
    if (
      monthlySpent + monthlyReserved + input.estimatedMicroUsd >
      input.monthlyLimitMicroUsd
    )
      throw new AIBudgetExceededError(
        "AI call blocked: monthly budget reservation would exceed its limit.",
      );
    if (
      input.stageLimitMicroUsd !== undefined &&
      stageSpent + stageReserved + input.estimatedMicroUsd >
        input.stageLimitMicroUsd
    )
      throw new AIBudgetExceededError(
        "AI call blocked: stage budget reservation would exceed its limit.",
      );
    const createdAt = new Date(this.now()).toISOString();
    const reservation: BudgetReservation = {
      reservationId: crypto.randomUUID(),
      operationId: input.operationId,
      projectId: input.projectId,
      month: input.month,
      stage: input.stage,
      estimatedMicroUsd: input.estimatedMicroUsd,
      createdAt,
      expiresAt: new Date(this.now() + input.ttlSeconds * 1000).toISOString(),
      status: "reserved",
    };
    this.reservations.set(reservation.reservationId, reservation);
    if (input.operationId)
      this.operations.set(input.operationId, reservation.reservationId);
    if (!this.projects.has(input.projectId))
      this.projects.set(input.projectId, ledger);
    return structuredClone(reservation);
  }
  async commit(reservationId: string, call: AIModelCall) {
    const reservation = this.reservations.get(reservationId);
    if (reservation?.status === "committed")
      return structuredClone(
        this.projects.get(reservation.projectId) ??
          createLedger(reservation.projectId),
      );
    if (!reservation || reservation.status !== "reserved")
      throw new Error("Budget reservation is not committable.");
    const ledger =
      this.projects.get(reservation.projectId) ??
      createLedger(reservation.projectId);
    const actual = usdToMicroUsd(call.costUsd);
    reservation.status = "committed";
    const updated = appendModelCall(ledger, {
      ...call,
      stage: reservation.stage,
      operationId: reservation.operationId,
      budgetOverrun: actual > reservation.estimatedMicroUsd,
      occurredAt: call.occurredAt ?? new Date(this.now()).toISOString(),
    });
    this.projects.set(reservation.projectId, updated);
    return structuredClone(updated);
  }
  async release(reservationId: string) {
    const value = this.reservations.get(reservationId);
    if (value?.status === "reserved") {
      value.status = "released";
      if (value.operationId) this.operations.delete(value.operationId);
    }
  }
  async resolveUnknown(reservationId: string) {
    const value = this.reservations.get(reservationId);
    if (value?.status === "reserved") value.status = "unknown_provider_outcome";
  }
  async getOperationResult(operationId: string) {
    const value = this.operationResults.get(operationId);
    return value ? structuredClone(value) : undefined;
  }
  async getOperationState(
    operationId: string,
  ): Promise<AIOperationState | undefined> {
    this.expire();
    const reservationId = this.operations.get(operationId);
    if (!reservationId) return undefined;
    const value = this.reservations.get(reservationId);
    if (!value) return undefined;
    return structuredClone({
      operationId,
      reservationId: value.reservationId,
      projectId: value.projectId,
      stage: value.stage,
      status: value.status,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
    });
  }
  async saveOperationResult(result: AIOperationResult) {
    this.operationResults.set(result.operationId, structuredClone(result));
  }
  async getUsageSnapshot(
    projectId: string,
    month: string,
    projectLimitUsd: number,
    monthlyLimitUsd: number,
  ): Promise<ProjectAIUsageSnapshot> {
    const ledger = this.projects.get(projectId) ?? createLedger(projectId);
    const projectReserved = microUsdToUsd(this.reserved(projectId));
    const monthlySpent = this.monthSpent(month);
    const monthlyReserved = microUsdToUsd(this.reserved(undefined, month));
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
    ] as AIStage[]) {
      const spentUsd = ledger.modelCalls
          .filter((call) => call.stage === stage)
          .reduce((sum, call) => sum + call.costUsd, 0),
        reservedUsd = microUsdToUsd(this.reserved(projectId, undefined, stage));
      if (spentUsd || reservedUsd) stages[stage] = { spentUsd, reservedUsd };
    }
    return {
      projectId,
      spentUsd: ledger.totalCostUsd,
      reservedUsd: projectReserved,
      remainingUsd: Math.max(
        0,
        projectLimitUsd - ledger.totalCostUsd - projectReserved,
      ),
      monthlySpentUsd: monthlySpent,
      monthlyReservedUsd: monthlyReserved,
      monthlyRemainingUsd: Math.max(
        0,
        monthlyLimitUsd - monthlySpent - monthlyReserved,
      ),
      stages,
      calls: structuredClone(ledger.modelCalls),
      status: getBudgetStatus(
        ledger.totalCostUsd + projectReserved,
        projectLimitUsd,
      ),
    };
  }
  async health() {
    return {
      status: "ok" as const,
      store: "memory" as const,
      atomicReservations: true,
    };
  }
}
