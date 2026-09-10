import assert from "node:assert/strict";
import {
  OptimisticConcurrencyError,
  assertMetadataOnly,
} from "../../domain/project-persistence/index.js";
import {
  MockDurableProjectRepository,
  createMockDurableDatabase,
} from "./mock-durable-repository.js";
import { persistenceFixtures } from "./fixtures.js";
const db = createMockDurableDatabase(),
  repo = new MockDurableProjectRepository(db),
  project = await repo.createProject({
    projectId: "p",
    operationId: "create:p",
  });
assert.equal(project.revision, 1);
const checkpoint = await repo.saveWorkflowCheckpoint({
    projectId: "p",
    versionId: "v1",
    stage: "creative_direction",
    operationId: "creative:1",
    fingerprint: "creative-fp",
    expectedRevision: 1,
    payload: { sessionId: "creative" },
  }),
  duplicate = await repo.saveWorkflowCheckpoint({
    projectId: "p",
    versionId: "v1",
    stage: "creative_direction",
    operationId: "creative:1",
    fingerprint: "creative-fp",
    expectedRevision: 1,
    payload: { sessionId: "creative" },
  });
assert.equal(checkpoint.checkpointId, duplicate.checkpointId);
await assert.rejects(
  () =>
    repo.saveWorkflowCheckpoint({
      projectId: "p",
      versionId: "v1",
      stage: "layout",
      operationId: "stale",
      fingerprint: "stale",
      expectedRevision: 1,
      payload: {},
    }),
  OptimisticConcurrencyError,
);
assert.throws(() => assertMetadataOnly({ image: new Uint8Array([1]) }));
assert.throws(() => assertMetadataOnly({ DATABASE_URL: "secret" }));
assert.doesNotThrow(() =>
  assertMetadataOnly({
    schemaVersion: "1.0.0",
    sessionId: "reference-session",
    aiUsage: {
      inputTokens: 1200,
      outputTokens: 400,
      cachedInputTokens: 300,
      cacheWriteTokens: 20,
    },
    quality: {
      compositionReasoning: 91,
      hierarchyReasoning: 88,
      typographicReasoning: 86,
      colorReasoning: 90,
      physicalPlausibility: 84,
    },
  }),
);
for (const field of [
  "OPENAI_API_KEY",
  "databaseUrl",
  "authorization",
  "credential",
  "rawPrompt",
  "rawChainOfThought",
])
  assert.throws(
    () => assertMetadataOnly({ [field]: "private" }),
    /Private field/,
  );
const fixtures = persistenceFixtures(),
  current = await repo.getProject("p"),
  authority = await repo.saveProductionAuthority({
    projectId: "p",
    versionId: "v1",
    operationId: "authority:1",
    fingerprint: "authority-fp",
    expectedRevision: current!.revision,
    postRenderReview: fixtures.post,
    visualApprovedPackage: fixtures.pkg,
  });
assert.equal(authority.activeAssetResolutions[0]?.assetId, "asset-active");
assert.equal(
  authority.activeAssetResolutions.some((item) => item.assetId === "asset-old"),
  false,
);
console.log(
  "Persistence validation passed: metadata-only records, active authority, concurrency and idempotency.",
);
