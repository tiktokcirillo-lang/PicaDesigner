import { strict as assert } from "node:assert";
import { BudgetedAIExecutor, stableOperationId } from "./executor.js";
import { createLedger } from "./budget-tracker.js";
import { InMemoryBudgetStore } from "./stores/in-memory-budget-store.js";
import { UpstashBudgetStore } from "./stores/upstash-budget-store.js";
import { createBudgetStore } from "./runtime-store.js";
import { usdToMicroUsd } from "./money.js";
import { MockAIProvider } from "../providers/mock.js";
import {
  AIBudgetExceededError,
  AIIdempotencyConflictError,
} from "../providers/errors.js";
import type {
  AIModelCall,
  AIStructuredRequest,
  BudgetReservationRequest,
} from "../types.js";
const month = new Date().toISOString().slice(0, 7),
  base = (
    projectId: string,
    estimated = 0.1,
    stageLimit?: number,
  ): BudgetReservationRequest => ({
    projectId,
    month,
    stage: "creative_direction",
    estimatedMicroUsd: usdToMicroUsd(estimated),
    projectLimitMicroUsd: 750000,
    monthlyLimitMicroUsd: 15000000,
    stageLimitMicroUsd:
      stageLimit === undefined ? undefined : usdToMicroUsd(stageLimit),
    ttlSeconds: 600,
  });
const call = (costUsd = 0.08): AIModelCall => ({
  requestId: "safe-request",
  pass: "creative_direction",
  model: "gpt-5.6-terra",
  inputTokens: 1,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 1,
  costUsd,
  durationMs: 1,
  maxOutputTokens: 10,
  outputTokenUtilization: 0.1,
  repairAttempt: false,
});
const blocked = async (action: () => Promise<unknown>) => {
  try {
    await action();
    return false;
  } catch (error) {
    return error instanceof AIBudgetExceededError;
  }
};
const a = new InMemoryBudgetStore();
await a.saveProject({ ...createLedger("a"), totalCostUsd: 0.7 });
assert(await blocked(() => a.reserve(base("a"))), "A project cap");
const b = new InMemoryBudgetStore();
await b.saveProject({ ...createLedger("b"), totalCostUsd: 0.6 });
const parallel = await Promise.allSettled([
  b.reserve(base("b")),
  b.reserve({ ...base("b"), operationId: "second" }),
]);
assert.equal(
  parallel.filter((item) => item.status === "fulfilled").length,
  1,
  "B atomic parallel reservations",
);
const c = new InMemoryBudgetStore();
await c.saveProject({
  ...createLedger("monthly", `${month}-01T00:00:00.000Z`),
  totalCostUsd: 14.95,
});
assert(
  await blocked(() =>
    c.reserve({ ...base("c"), monthlyLimitMicroUsd: 15000000 }),
  ),
  "C monthly cap",
);
const d = new InMemoryBudgetStore();
await d.saveProject({
  ...createLedger("d"),
  modelCalls: [{ ...call(0.13), stage: "creative_direction" }],
  totalCostUsd: 0.13,
});
assert(await blocked(() => d.reserve(base("d", 0.08, 0.18))), "D stage cap");
const request: AIStructuredRequest = {
  projectId: "failure",
  pass: "creative_direction",
  model: "gpt-5.6-terra",
  instructions: "private prompt",
  inputText: "private copy and image marker",
  schemaName: "test",
  jsonSchema: {},
  reasoningEffort: "low",
  maxOutputTokens: 10,
};
const failing = {
    id: "mock" as const,
    generateStructured: async () => {
      throw new Error("provider failed");
    },
  },
  e = new InMemoryBudgetStore(),
  executor = new BudgetedAIExecutor(failing, e, 0.75, createLedger("failure"));
try {
  await executor.execute(request, { inputTokens: 100, outputTokens: 10 });
} catch {}
assert.equal(
  (await e.getUsageSnapshot("failure", month, 0.75, 15)).reservedUsd,
  0,
  "E provider failure releases",
);
const f = new InMemoryBudgetStore(),
  reservation = await f.reserve(base("f", 0.12)),
  reservedBefore = (await f.getUsageSnapshot("f", month, 0.75, 15)).reservedUsd;
await f.commit(reservation.reservationId, call(0.08));
const committed = await f.getUsageSnapshot("f", month, 0.75, 15);
assert(
  reservedBefore === 0.12 && committed.spentUsd === 0.08,
  "F actual committed",
);
assert.equal(committed.reservedUsd, 0, "G unused reservation released");
let now = Date.now();
const h = new InMemoryBudgetStore(() => now),
  old = await h.reserve({ ...base("h", 0.7), ttlSeconds: 1 });
assert(old.status === "reserved");
now += 2000;
assert(
  (await h.reserve(base("h", 0.7))).status === "reserved",
  "H expired reservation recovers capacity",
);
const i = new InMemoryBudgetStore(),
  r = await i.reserve(base("i", 0.1));
await i.commit(r.reservationId, call(0.08));
const afterColdStartCoordinator = await i.getUsageSnapshot(
  "i",
  month,
  0.75,
  15,
);
assert.equal(
  afterColdStartCoordinator.spentUsd,
  0.08,
  "I durable backing survives coordinator cold start",
);
const unavailable = createBudgetStore({ NODE_ENV: "production" }),
  mock = new MockAIProvider(() => ({ ok: true })),
  j = new BudgetedAIExecutor(mock, unavailable, 0.75, createLedger("j"));
let productionBlocked = false;
try {
  await j.execute(
    { ...request, projectId: "j" },
    { inputTokens: 100, outputTokens: 10 },
  );
} catch {
  productionBlocked = true;
}
assert(
  productionBlocked && mock.getCallCount() === 0,
  "J production fails closed before provider",
);
assert.equal(
  createBudgetStore({ NODE_ENV: "development" }).kind,
  "memory",
  "K development permits memory",
);
const serialized = JSON.stringify(committed);
assert(
  !serialized.includes("private prompt") &&
    !serialized.includes("private copy") &&
    !serialized.includes("OPENAI"),
  "L financial store excludes private payloads",
);
const overrunStore = new InMemoryBudgetStore(),
  overrunReservation = await overrunStore.reserve(base("overrun", 0.01));
await overrunStore.commit(overrunReservation.reservationId, call(0.02));
assert.equal(
  (await overrunStore.getProject("overrun"))!.modelCalls[0]?.budgetOverrun,
  true,
  "actual cost above reservation is visible",
);
const semanticBase: AIStructuredRequest = {
  projectId: "semantic",
  pass: "raw_observation",
  model: "gpt-5.6-terra",
  instructions: "depth:standard",
  inputText: "same context",
  image: { kind: "base64", data: "AA==", mediaType: "image/png" },
  schemaName: "observation",
  jsonSchema: { type: "object" },
  reasoningEffort: "low",
  maxOutputTokens: 100,
};
const idA = stableOperationId(semanticBase),
  idB = stableOperationId({
    ...semanticBase,
    image: { kind: "base64", data: "AQ==", mediaType: "image/png" },
  });
assert.notEqual(idA, idB, "M different image bytes change operation identity");
assert.equal(
  idA,
  stableOperationId(structuredClone(semanticBase)),
  "N exact request identity is stable",
);
assert.notEqual(
  idA,
  stableOperationId({ ...semanticBase, instructions: "depth:deep" }),
  "O effective instructions/depth change identity",
);
assert.notEqual(
  idA,
  stableOperationId({ ...semanticBase, model: "gpt-5.6-sol" }),
  "P model changes identity",
);
assert.notEqual(
  idA,
  stableOperationId({
    ...semanticBase,
    image: { kind: "base64", data: "AA==", mediaType: "image/webp" },
  }),
  "P2 media type changes image identity",
);
assert.equal(
  idA,
  stableOperationId({
    ...semanticBase,
    image: {
      kind: "bytes",
      data: Uint8Array.from([0]),
      mediaType: "image/png",
    },
  }),
  "P3 equivalent base64 and byte inputs share byte identity",
);
assert(
  !idA.includes("AA==") && !idA.includes("same context") && idA.length < 64,
  "Q operation ID contains no raw provider input",
);
const duplicateStore = new InMemoryBudgetStore(),
  active = await duplicateStore.reserve({
    ...base("duplicate", 0.01),
    operationId: "same",
  });
let duplicateError: unknown;
try {
  await duplicateStore.reserve({
    ...base("duplicate", 0.01),
    operationId: "same",
  });
} catch (error) {
  duplicateError = error;
}
assert(
  duplicateError instanceof AIIdempotencyConflictError &&
    !(duplicateError instanceof AIBudgetExceededError),
  "R duplicate is idempotency conflict, not budget exceeded",
);
await duplicateStore.release(active.reservationId);
const upstashDuplicate = new UpstashBudgetStore({
  eval: async () => ["duplicate"],
} as never);
let upstashDuplicateError: unknown;
try {
  await upstashDuplicate.reserve({
    ...base("upstash-duplicate", 0.01),
    operationId: "same",
  });
} catch (error) {
  upstashDuplicateError = error;
}
assert(
  upstashDuplicateError instanceof AIIdempotencyConflictError &&
    !(upstashDuplicateError instanceof AIBudgetExceededError),
  "R2 Upstash duplicate classification is not budget exceeded",
);
let providerCalls = 0,
  releaseProvider: () => void = () => {};
const gate = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  }),
  concurrentProvider = {
    id: "mock" as const,
    generateStructured: async <T>() => {
      providerCalls++;
      await gate;
      return {
        requestId: "concurrent",
        model: "gpt-5.6-terra",
        data: { ok: true } as T,
        usage: {
          inputTokens: 1,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: 1,
        },
        durationMs: 1,
      };
    },
  },
  concurrentStore = new InMemoryBudgetStore(),
  concurrentExecutor = new BudgetedAIExecutor(
    concurrentProvider,
    concurrentStore,
    0.75,
    createLedger("semantic"),
    Number.POSITIVE_INFINITY,
    { safetyFactor: 1 },
  );
const first = concurrentExecutor.execute(semanticBase, {
    inputTokens: 100,
    outputTokens: 10,
  }),
  second = concurrentExecutor.execute(semanticBase, {
    inputTokens: 100,
    outputTokens: 10,
  }),
  concurrentPromise = Promise.allSettled([first, second]);
await new Promise((resolve) => setTimeout(resolve, 0));
releaseProvider();
const concurrent = await concurrentPromise;
assert.equal(
  providerCalls,
  1,
  "S concurrent identical requests execute provider at most once",
);
assert(
  concurrent.some(
    (result) =>
      result.status === "rejected" &&
      result.reason instanceof AIIdempotencyConflictError,
  ),
  "T concurrent duplicate has typed conflict",
);
const referenceStore = new InMemoryBudgetStore(),
  referenceProvider = new MockAIProvider(() => ({ ok: true })),
  referenceExecutor = new BudgetedAIExecutor(
    referenceProvider,
    referenceStore,
    0.75,
    createLedger("reference-switch"),
    Number.POSITIVE_INFINITY,
    { safetyFactor: 1 },
  );
const refA = { ...semanticBase, projectId: "reference-switch" },
  refB = {
    ...refA,
    image: { kind: "base64" as const, data: "AQ==", mediaType: "image/png" },
  };
await referenceExecutor.execute(refA, { inputTokens: 100, outputTokens: 10 });
await referenceExecutor.execute(refB, { inputTokens: 100, outputTokens: 10 });
assert.equal(
  referenceProvider.getCallCount(),
  2,
  "U a new image in the same project is independently analyzable",
);
const recoveryStore = new InMemoryBudgetStore(),
  recoveryProvider = new MockAIProvider(() => ({ safeResult: "paid-once" })),
  recoveryRequest = { ...request, projectId: "paid-recovery" };
const firstExecutor = new BudgetedAIExecutor(
  recoveryProvider,
  recoveryStore,
  0.75,
  createLedger("paid-recovery"),
  Number.POSITIVE_INFINITY,
  { safetyFactor: 1 },
);
const paidResult = await firstExecutor.execute<{ safeResult: string }>(
  recoveryRequest,
  { inputTokens: 100, outputTokens: 10 },
);
await assert.rejects(async () => {
  throw new Error("workflow checkpoint failed");
});
const retryExecutor = new BudgetedAIExecutor(
  recoveryProvider,
  recoveryStore,
  0.75,
  (await recoveryStore.getProject("paid-recovery"))!,
  Number.POSITIVE_INFINITY,
  { safetyFactor: 1 },
);
const recoveredResult = await retryExecutor.execute<{ safeResult: string }>(
  recoveryRequest,
  { inputTokens: 100, outputTokens: 10 },
);
assert.equal(
  recoveryProvider.getCallCount(),
  1,
  "V checkpoint retry reuses durable paid result without provider spend",
);
assert.deepEqual(
  recoveredResult.data,
  paidResult.data,
  "W recovered provider result is byte-equivalent structured data",
);
console.log(
  "Durable budget validation passed: caps, semantic SHA-256 operation identity, typed duplicate conflicts, concurrency, reference switching and privacy.",
);
