import { strict as assert } from "node:assert";
import {
  createMinimalVisualForensicsReport,
  mapForensicsToDesignDNA,
} from "../../../domain/visual-forensics/index.js";
import { createSemanticExclusions } from "../../../domain/art-direction/index.js";
import {
  createReferenceIntelligence,
  isReusableReferenceCheckpoint,
} from "../../../application/reference-intelligence/index.js";
import { MockAIProvider } from "../providers/mock.js";
import {
  AIBudgetExceededError,
  AIIdempotencyConflictError,
} from "../providers/errors.js";
import type {
  AIModelCall,
  AIStructuredRequest,
  AIUsageResult,
} from "../types.js";
import { createLedger } from "./budget-tracker.js";
import {
  BudgetedAIExecutor,
  legacyRecoveryOperationId,
  stableOperationId,
  type LegacyRecoveryTelemetryEvent,
} from "./executor.js";
import { InMemoryBudgetStore } from "./stores/in-memory-budget-store.js";
import { UpstashBudgetStore } from "./stores/upstash-budget-store.js";
import { usdToMicroUsd } from "./money.js";

const month = new Date().toISOString().slice(0, 7);
const request: AIStructuredRequest = {
  projectId: "legacy-project",
  pass: "creative_direction",
  model: "gpt-5.6-terra",
  schemaName: "legacy-safe-result",
  jsonSchema: { type: "object" },
  instructions: "Return the requested safe structure.",
  inputText: "stable effective input",
  reasoningEffort: "low",
  maxOutputTokens: 100,
};
const legacyCall = (operationId: string, costUsd = 0.08): AIModelCall => ({
  requestId: "legacy-provider-request",
  pass: request.pass,
  model: request.model,
  inputTokens: 100,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 20,
  costUsd,
  durationMs: 1,
  maxOutputTokens: request.maxOutputTokens,
  outputTokenUtilization: 0.2,
  repairAttempt: false,
  stage: "creative_direction",
  operationId,
});
const seedLegacyOrphan = async (
  store: InMemoryBudgetStore,
  projectId = request.projectId,
  costUsd = 0.08,
) => {
  const effectiveRequest = { ...request, projectId };
  const operationId = stableOperationId(effectiveRequest);
  const reservation = await store.reserve({
    projectId,
    month,
    stage: "creative_direction",
    operationId,
    estimatedMicroUsd: usdToMicroUsd(costUsd),
    projectLimitMicroUsd: usdToMicroUsd(0.75),
    monthlyLimitMicroUsd: usdToMicroUsd(15),
    ttlSeconds: 600,
  });
  await store.commit(reservation.reservationId, legacyCall(operationId, costUsd));
  assert.equal(await store.getOperationResult(operationId), undefined);
  assert.equal((await store.getOperationState(operationId))?.status, "committed");
  return { effectiveRequest, operationId };
};

// Exact production case: committed reservation and spend, but no durable result.
const store = new InMemoryBudgetStore();
const { effectiveRequest, operationId } = await seedLegacyOrphan(store);
const recoveryId = legacyRecoveryOperationId(operationId);
assert.equal(recoveryId, legacyRecoveryOperationId(operationId));
assert(!recoveryId.includes(request.inputText));
const provider = new MockAIProvider(() => ({ recovered: true }));
const telemetry: LegacyRecoveryTelemetryEvent[] = [];
const executor = new BudgetedAIExecutor(
  provider,
  store,
  0.75,
  (await store.getProject(request.projectId))!,
  Number.POSITIVE_INFINITY,
  { safetyFactor: 1, onLegacyRecovery: (event) => telemetry.push(event) },
);
const first = await executor.execute<{ recovered: boolean }>(effectiveRequest, {
  inputTokens: 100,
  outputTokens: 20,
});
assert.equal(first.data.recovered, true);
assert.equal(provider.getCallCount(), 1);
assert.equal((await store.getOperationState(recoveryId))?.status, "committed");
assert.equal((await store.getProject(request.projectId))?.modelCalls.length, 2);
assert.equal(telemetry[0]?.event, "legacy_ai_operation_recovery");
assert.equal(telemetry[0]?.status, "started");
assert.equal(JSON.stringify(telemetry).includes(request.inputText), false);

const retry = new BudgetedAIExecutor(
  provider,
  store,
  0.75,
  (await store.getProject(request.projectId))!,
  Number.POSITIVE_INFINITY,
  { safetyFactor: 1, onLegacyRecovery: (event) => telemetry.push(event) },
);
await retry.execute(effectiveRequest, { inputTokens: 100, outputTokens: 20 });
assert.equal(provider.getCallCount(), 1, "retry reuses recovery result");
assert.equal(telemetry.at(-1)?.status, "result_reused");

// Active duplicates remain conflicts and never invoke the provider.
const activeStore = new InMemoryBudgetStore();
const activeId = stableOperationId({ ...request, projectId: "active" });
await activeStore.reserve({
  projectId: "active",
  month,
  stage: "creative_direction",
  operationId: activeId,
  estimatedMicroUsd: 1000,
  projectLimitMicroUsd: 750000,
  monthlyLimitMicroUsd: 15000000,
  ttlSeconds: 600,
});
const activeProvider = new MockAIProvider(() => ({ shouldNotRun: true }));
await assert.rejects(
  () =>
    new BudgetedAIExecutor(
      activeProvider,
      activeStore,
      0.75,
      createLedger("active"),
      Infinity,
      { safetyFactor: 1 },
    ).execute({ ...request, projectId: "active" }, { inputTokens: 1, outputTokens: 1 }),
  AIIdempotencyConflictError,
);
assert.equal(activeProvider.getCallCount(), 0);

// Current operations with durable results retain the existing zero-cost behavior.
const currentStore = new InMemoryBudgetStore();
const currentProvider = new MockAIProvider(() => ({ current: true }));
const currentRequest = { ...request, projectId: "current" };
const currentExecutor = new BudgetedAIExecutor(
  currentProvider,
  currentStore,
  0.75,
  createLedger("current"),
  Infinity,
  { safetyFactor: 1 },
);
await currentExecutor.execute(currentRequest, { inputTokens: 10, outputTokens: 10 });
await currentExecutor.execute(currentRequest, { inputTokens: 10, outputTokens: 10 });
assert.equal(currentProvider.getCallCount(), 1);

// Parallel recovery reserves the deterministic recovery ID only once.
const parallelStore = new InMemoryBudgetStore();
const parallelSeed = await seedLegacyOrphan(parallelStore, "parallel");
let parallelCalls = 0;
let releaseProvider = () => {};
const providerGate = new Promise<void>((resolve) => {
  releaseProvider = resolve;
});
const gatedProvider = {
  id: "mock" as const,
  generateStructured: async <T>(providerRequest: AIStructuredRequest) => {
    parallelCalls += 1;
    await providerGate;
    return {
      requestId: "parallel-recovery",
      model: providerRequest.model,
      data: { recovered: true } as T,
      usage: { inputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 10 },
      durationMs: 1,
    };
  },
};
const parallelLedger = (await parallelStore.getProject("parallel"))!;
const makeParallelExecutor = () =>
  new BudgetedAIExecutor(gatedProvider, parallelStore, 0.75, parallelLedger, Infinity, {
    safetyFactor: 1,
  });
const parallelA = makeParallelExecutor().execute(parallelSeed.effectiveRequest, {
  inputTokens: 10,
  outputTokens: 10,
});
const parallelB = makeParallelExecutor().execute(parallelSeed.effectiveRequest, {
  inputTokens: 10,
  outputTokens: 10,
});
const parallelSettlement = Promise.allSettled([parallelA, parallelB]);
await new Promise((resolve) => setTimeout(resolve, 0));
releaseProvider();
const parallelResults = await parallelSettlement;
assert.equal(parallelCalls, 1);
assert(
  parallelResults.some(
    (result) =>
      result.status === "rejected" &&
      result.reason instanceof AIIdempotencyConflictError,
  ),
);
await makeParallelExecutor().execute(parallelSeed.effectiveRequest, {
  inputTokens: 10,
  outputTokens: 10,
});
assert.equal(parallelCalls, 1, "post-completion retry reuses recovery receipt");

// Legacy spend remains and insufficient remaining budget blocks before provider.
const cappedStore = new InMemoryBudgetStore();
const cappedSeed = await seedLegacyOrphan(cappedStore, "capped", 0.74);
const cappedProvider = new MockAIProvider(() => ({ shouldNotRun: true }));
const cappedLedger = (await cappedStore.getProject("capped"))!;
await assert.rejects(
  () =>
    new BudgetedAIExecutor(
      cappedProvider,
      cappedStore,
      0.75,
      cappedLedger,
      Infinity,
      { safetyFactor: 1 },
    ).execute(cappedSeed.effectiveRequest, { inputTokens: 100000, outputTokens: 100000 }),
  AIBudgetExceededError,
);
assert.equal(cappedProvider.getCallCount(), 0);
assert.equal((await cappedStore.getProject("capped"))?.totalCostUsd, 0.74);

// A compatible durable checkpoint is selected before constructing/calling a provider.
const report = createMinimalVisualForensicsReport(
  { sourceId: "checkpoint", analysisDepth: "standard" },
  createSemanticExclusions(),
);
report.evidenceQuality.overall = 0.8;
report.overallConfidence = 0.8;
const designDNA = mapForensicsToDesignDNA(report);
const aiUsage: AIUsageResult = {
  inputTokens: 1,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 1,
  totalCostUsd: 0.01,
  targetCostUsd: 0.5,
  limitCostUsd: 0.75,
  modelsUsed: [request.model],
  calls: [],
  escalationStatus: "not_needed",
};
let checkpointProviderCalls = 0;
const checkpoint = await createReferenceIntelligence(
  {
    projectId: "checkpoint-project",
    image: { kind: "base64", data: "AA==", mediaType: "image/png" },
    imageMetadata: { imageFingerprint: "checksum-1" },
    analysisDepth: "standard",
  },
  {
    analyze: async () => {
      checkpointProviderCalls += 1;
      return {
        forensics: report,
        designDNA,
        quality: {
          score: 90,
          dimensions: {
            evidenceIntegrity: 90,
            compositionReasoning: 90,
            hierarchyReasoning: 90,
            typographicReasoning: 90,
            colorReasoning: 90,
            physicalPlausibility: 90,
            semanticSeparation: 90,
            antiAiDetection: 90,
            confidenceCalibration: 90,
          },
          issues: [],
          requiresCritic: false,
        },
        aiUsage,
      };
    },
  },
);
assert.equal(checkpointProviderCalls, 1);
const selected = isReusableReferenceCheckpoint(checkpoint, {
  projectId: "checkpoint-project",
  imageFingerprint: "checksum-1",
  analysisDepth: "standard",
});
if (!selected) checkpointProviderCalls += 1;
assert.equal(checkpointProviderCalls, 1, "compatible checkpoint avoids provider");

// Durable adapter resolves safe state without exposing its physical Redis keys.
let redisReads = 0;
const upstashStateStore = new UpstashBudgetStore({
  get: async () => {
    redisReads += 1;
    return redisReads === 1
      ? "reservation-safe"
      : JSON.stringify({
          reservationId: "reservation-safe",
          operationId: "legacy-safe-id",
          projectId: "safe-project",
          month,
          stage: "creative_direction",
          estimatedMicroUsd: 1000,
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-12-01T00:00:00.000Z",
          status: "committed",
        });
  },
} as never);
const durableState = await upstashStateStore.getOperationState("legacy-safe-id");
assert.deepEqual(durableState, {
  operationId: "legacy-safe-id",
  reservationId: "reservation-safe",
  projectId: "safe-project",
  stage: "creative_direction",
  status: "committed",
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
});
assert.equal(JSON.stringify(durableState).includes("picadesigner:ai"), false);

console.log(
  "Legacy AI recovery validation passed: deterministic recovery, current receipt reuse, active/parallel conflict, hard-cap guard and durable checkpoint reuse.",
);
