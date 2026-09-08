import assert from "node:assert/strict";
import { OptimisticConcurrencyError } from "../../domain/project-persistence/index.js";
import {
  MockDurableProjectRepository,
  createMockDurableDatabase,
} from "./mock-durable-repository.js";
import { persistenceFixtures } from "./fixtures.js";
import { InMemoryGeneratedAssetStore } from "../image-generation/index.js";
import { validateProductionAuthorityBacking } from "../../application/project-persistence/index.js";
import { MemoryProductionArtifactStore } from "../export-engine/index.js";
import { createHash } from "node:crypto";
const db = createMockDurableDatabase(),
  a = new MockDurableProjectRepository(db),
  seed = persistenceFixtures(),
  assetStore = new InMemoryGeneratedAssetStore(),
  activeRef = await assetStore.put({
    projectId: "p",
    assetId: "asset-active",
    bytes: seed.bytes,
    mediaType: "image/png",
    checksum: seed.checksum,
  }),
  fixtures = persistenceFixtures(activeRef);
let project = await a.createProject({
  projectId: "p",
  operationId: "create:p",
});
for (const [stage, payload] of [
  ["creative_direction", { sessionId: "creative" }],
  ["layout", { sessionId: "layout" }],
  ["art_director_review", { sessionId: "review" }],
  ["render_session", { sessionId: "render" }],
  ["image_asset_session", { sessionId: "images" }],
  ["post_render_review", fixtures.post],
] as const) {
  const operationId = `${stage}:1`;
  await a.saveWorkflowCheckpoint({
    projectId: "p",
    versionId: "v1",
    stage,
    operationId,
    fingerprint: `fp:${stage}`,
    expectedRevision: project.revision,
    payload,
  });
  project = (await a.getProject("p"))!;
}
const authority = await a.saveProductionAuthority({
    projectId: "p",
    versionId: "v1",
    operationId: "authority:1",
    fingerprint: "authority-fp",
    expectedRevision: project.revision,
    postRenderReview: fixtures.post,
    visualApprovedPackage: fixtures.pkg,
  }),
  authorityDuplicate = await a.saveProductionAuthority({
    projectId: "p",
    versionId: "v1",
    operationId: "authority:1",
    fingerprint: "authority-fp",
    expectedRevision: 1,
    postRenderReview: fixtures.post,
    visualApprovedPackage: fixtures.pkg,
  });
assert.equal(authority.authorityId, authorityDuplicate.authorityId);
const exportBlobBackend = new Map<string, Uint8Array>(),
  exportStoreA = new MemoryProductionArtifactStore(exportBlobBackend),
  exportBytes = Uint8Array.from([80, 78, 71]),
  exportChecksum = createHash("sha256").update(exportBytes).digest("hex"),
  exportRef = await exportStoreA.put({
    projectId: "p",
    exportFingerprint: "export-fp",
    artifactId: "artifact-1",
    filename: "p.png",
    bytes: exportBytes,
    mediaType: "image/png",
    checksum: exportChecksum,
  });
fixtures.exportSession.artifacts[0]!.backingRef = exportRef;
fixtures.exportSession.artifacts[0]!.checksum = exportChecksum;
const exportRecord = await a.saveExportSession({
    projectId: "p",
    authorityId: authority.authorityId,
    operationId: "export:1",
    session: fixtures.exportSession,
  }),
  exportDuplicate = await a.saveExportSession({
    projectId: "p",
    authorityId: authority.authorityId,
    operationId: "export:1",
    session: fixtures.exportSession,
  });
assert.equal(exportRecord.exportSessionId, exportDuplicate.exportSessionId);
const b = new MockDurableProjectRepository(db),
  restored = await b.getSafeProjectState("p"),
  restoredAuthority = await b.getProductionAuthority("p"),
  restoredExport = await b.getExportSession("p", "export-1");
assert(restored);
assert.equal(
  restored.project.latestProductionAuthorityId,
  authority.authorityId,
);
assert.equal(Object.keys(restored.workflow).length, 6);
assert.equal(restored.activeAssetResolutions[0]?.assetId, "asset-active");
assert.equal(restoredAuthority?.renderSessionId, "render");
assert.equal(restoredExport?.session.artifacts[0]?.artifactId, "artifact-1");
const exportStoreB = new MemoryProductionArtifactStore(exportBlobBackend);
assert(
  await exportStoreB.exists(
    restoredExport!.session.artifacts[0]!.backingRef!,
    "p",
  ),
);
const handle = await exportStoreB.createReadHandle(
  restoredExport!.session.artifacts[0]!.backingRef!,
  "p",
  "image/png",
  "p.png",
  300,
);
assert(handle.url && !JSON.stringify(restoredExport).includes(handle.url));
assert(
  (await validateProductionAuthorityBacking(restoredAuthority!, assetStore))
    .valid,
);
await assetStore.delete(activeRef, "p");
assert(
  !(await validateProductionAuthorityBacking(restoredAuthority!, assetStore))
    .valid,
);
assert.equal(
  (await b.getExportSession("p", "export-1"))?.session.status,
  "ready",
);
assert(
  !JSON.stringify(restored).match(
    /DATABASE_URL|BLOB_READ_WRITE_TOKEN|UPSTASH|data:image|rawPrompt/i,
  ),
);
const staleRevision = restored.project.revision,
  clientB = await b.saveWorkflowCheckpoint({
    projectId: "p",
    versionId: "v2",
    stage: "layout",
    operationId: "layout:2",
    fingerprint: "layout-new",
    expectedRevision: staleRevision,
    payload: { sessionId: "server-new" },
  });
await assert.rejects(
  () =>
    a.saveWorkflowCheckpoint({
      projectId: "p",
      versionId: "v1",
      stage: "layout",
      operationId: "layout:stale",
      fingerprint: "layout-old",
      expectedRevision: staleRevision,
      payload: { sessionId: "browser-old" },
    }),
  OptimisticConcurrencyError,
);
assert.equal(
  ((await b.getSafeProjectState("p"))?.workflow.layout as { sessionId: string })
    .sessionId,
  "server-new",
);
assert.equal(clientB.revision, staleRevision + 1);
const failingDb = createMockDurableDatabase(),
  failureRepo = new MockDurableProjectRepository(failingDb);
await failureRepo.createProject({ projectId: "failed", operationId: "create" });
failingDb.available = false;
await assert.rejects(() =>
  failureRepo.saveProductionAuthority({
    ...{
      projectId: "failed",
      versionId: "v1",
      operationId: "authority",
      fingerprint: "fp",
      expectedRevision: 1,
      postRenderReview: fixtures.post,
      visualApprovedPackage: { ...fixtures.pkg, projectId: "failed" },
    },
  }),
);
failingDb.available = true;
assert.equal(await failureRepo.getProductionAuthority("failed"), undefined);
assert.equal((await b.listProjects()).length, 1);
assert.equal(restoredExport?.projectId, "p");
console.log(
  "Cold-start PASS: recreated repository restored project, workflow, authority, active assets, exports, download lineage, idempotency, server-wins conflict and DB failure atomicity.",
);
