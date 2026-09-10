// @ts-nocheck -- compact operational fixtures expose only fields consumed by the orchestrator.
import assert from "node:assert/strict";
import {
  createCampaignFamily,
  type CampaignInvariantSet,
} from "../../domain/campaign-variants/index.js";
import {
  createMockCampaignDatabase,
  MockCampaignFamilyRepository,
} from "../../infrastructure/campaign-variants/repository.js";
import { runCampaignFamily } from "./run-family.js";
import {
  MemoryProductionArtifactStore,
  buildProductionZip,
  inspectProductionZip,
} from "../../infrastructure/export-engine/index.js";
import { createHash } from "node:crypto";
const invariants = {
  selectedCreativeRouteId: "route",
  creativeDirectionSessionId: "creative",
  creativeConcept: "concept",
  creativeDeviceIdentity: "device",
  heroRole: "product",
  primaryMessage: "message",
  approvedCopyContent: ["message", "cta"],
  mandatoryContent: [],
  sourceAssetChecksums: [],
  campaignVisualIdentity: "identity",
  majorHierarchyIntent: "hero-first",
  fingerprint: "inv",
} satisfies CampaignInvariantSet;
const db = createMockCampaignDatabase(),
  repoA = new MockCampaignFamilyRepository(db),
  family = createCampaignFamily({
    projectId: "p",
    operationId: "op",
    inputFingerprint: "fp",
    invariants,
    estimatedCostUsd: 0.4,
    hardCapUsd: 0.75,
    now: "2026-01-01T00:00:00.000Z",
  });
const created = await repoA.create(family),
  duplicate = await repoA.create(family);
assert.equal(created.familyId, duplicate.familyId);
assert.equal(db.families.length, 1);
const three = {
    ...created,
    variants: created.variants.map((v, i) => ({
      ...v,
      status: i === 3 ? ("failed" as const) : ("approved" as const),
    })),
    status: "partial" as const,
  },
  saved = await repoA.save(three, 1);
await assert.rejects(() => repoA.save(three, 1), /revision conflict/);
const repoB = new MockCampaignFamilyRepository(db),
  restored = await repoB.get("p", family.familyId);
assert(restored);
assert.equal(restored.revision, 2);
assert.deepEqual(
  restored.variants.map((v) => v.status),
  ["approved", "approved", "approved", "failed"],
);
const retry = {
  ...restored,
  variants: restored.variants.map((v) =>
    v.status === "failed" ? { ...v, status: "approved" as const } : v,
  ),
};
await repoB.save(retry, saved.revision);
assert.equal(
  (await repoA.latest("p"))?.variants.filter((v) => v.status === "approved")
    .length,
  4,
);
db.available = false;
await assert.rejects(() => repoB.latest("p"), /unavailable/);
console.log(
  "Campaign orchestration validation passed: idempotency, optimistic concurrency, partial cold-start restore and local retry isolation.",
);

const operationalDb = createMockCampaignDatabase(),
  operationalRepo = new MockCampaignFamilyRepository(operationalDb);
let operational = {
  ...createCampaignFamily({
    projectId: "operational",
    operationId: "operational",
    inputFingerprint: "family-fp",
    invariants,
    estimatedCostUsd: 0.4,
    hardCapUsd: 0.75,
  }),
  variants: createCampaignFamily({
    projectId: "operational",
    operationId: "operational",
    inputFingerprint: "family-fp",
    invariants,
    estimatedCostUsd: 0.4,
    hardCapUsd: 0.75,
  }).variants.map((variant) => ({
    ...variant,
    status: "layout_ready",
    layoutPlan: {
      schemaVersion: "1.0.0",
      layoutId: `layout_${variant.formatId}`,
      projectId: "operational",
      creativeDirectionSessionId: "creative",
      selectedRouteId: "route",
      format: { id: variant.formatId },
      canvas: { width: variant.width, height: variant.height },
      quality: {},
      warnings: [],
    },
    layoutSessionId: `layout_${variant.formatId}`,
    readiness: { ...variant.readiness, layout: true },
  })),
};
operational = await operationalRepo.create(operational);
const calls = {
  review: [] as string[],
  render: [] as string[],
  assets: [] as string[],
  qa: [] as string[],
  authority: [] as string[],
};
let failedFormat = "meta_ads_story_reels";
const engines = {
  review: async ({ formatId }) => {
    calls.review.push(formatId);
    return {
      sessionId: `review_${formatId}`,
      readyForRender: true,
      reviewedDesignPackage: { reviewSessionId: `review_${formatId}` },
      revisionRounds: [],
      cost: 0.01,
    };
  },
  render: async ({ review }) => {
    const formatId = review.sessionId.replace("review_", "");
    calls.render.push(formatId);
    return {
      sessionId: `render_${formatId}`,
      readiness: { missingRequiredAssets: [] },
      renderDocument: { scenes: [] },
    };
  },
  resolveAssets: async ({ render, registry }) => {
    const formatId = render.sessionId.replace("render_", "");
    calls.assets.push(formatId);
    return { render, registry };
  },
  qa: async ({ render }) => {
    const formatId = render.sessionId.replace("render_", "");
    calls.qa.push(formatId);
    const approved = formatId !== failedFormat;
    return {
      sessionId: `qa_${formatId}`,
      inputFingerprint: `qa-fp-${formatId}`,
      outcome: approved ? "approved" : "failed",
      visualApproved: approved,
      approvedPackage: approved
        ? { visualApprovalStatus: "approved" }
        : undefined,
      regenerationRounds: [],
      warnings: [],
      cost: 0.01,
    };
  },
  persistAuthority: async ({ variant, qa }) => {
    calls.authority.push(variant.formatId);
    return {
      authorityId: `authority_${variant.formatId}`,
      fingerprint: `package-fp-${qa.inputFingerprint}`,
    };
  },
};
const creative = { sessionId: "creative", selectedRouteId: "route" };
const first = await runCampaignFamily(
  {
    family: operational,
    currentFamilyFingerprint: "family-fp",
    creative,
    sourceRegistry: { projectId: "operational", assets: [] },
  },
  { repository: operationalRepo, engines },
);
assert.equal(first.family.status, "partial");
assert.equal(
  first.family.variants.filter((x) => x.status === "approved").length,
  3,
);
assert.equal(operationalDb.authorities.length, 0);
const siblingCalls = [...calls.review];
failedFormat = "";
const retried = await runCampaignFamily(
  {
    family: first.family,
    currentFamilyFingerprint: "family-fp",
    creative,
    sourceRegistry: { projectId: "operational", assets: [] },
    onlyFormatId: "meta_ads_story_reels",
  },
  { repository: operationalRepo, engines },
);
assert.equal(calls.review.length, siblingCalls.length + 1);
assert.equal(calls.review.at(-1), "meta_ads_story_reels");
assert.equal(retried.family.status, "approved");
assert(retried.family.approval.familyAuthorityId);
assert.equal(operationalDb.authorities.length, 1);
const coldRepo = new MockCampaignFamilyRepository(operationalDb),
  coldFamily = await coldRepo.get("operational", operational.familyId),
  coldAuthority = await coldRepo.getAuthority(
    "operational",
    retried.family.approval.familyAuthorityId,
  );
assert(coldFamily?.approval.metaAdsPackageReady && coldAuthority);
const blobData = new Map(),
  blobA = new MemoryProductionArtifactStore(blobData),
  zip = buildProductionZip([
    { path: "project_1x1.png", bytes: new Uint8Array([1]) },
    { path: "project_4x5.png", bytes: new Uint8Array([2]) },
    { path: "project_9x16.png", bytes: new Uint8Array([3]) },
    { path: "project_1.91x1.png", bytes: new Uint8Array([4]) },
    { path: "manifest.json", bytes: new Uint8Array([5]) },
  ]),
  zipChecksum = createHash("sha256").update(zip).digest("hex"),
  zipRef = await blobA.put({
    projectId: "operational",
    exportFingerprint: coldAuthority.fingerprint,
    artifactId: "zip",
    filename: "project_meta-ads-package.zip",
    bytes: zip,
    mediaType: "application/zip",
    checksum: zipChecksum,
  }),
  exportRecord = await operationalRepo.saveExport({
    exportSessionId: "family_export",
    familyId: operational.familyId,
    familyAuthorityId: coldAuthority.familyAuthorityId,
    projectId: "operational",
    operationId: "export:one",
    inputFingerprint: coldAuthority.fingerprint,
    profile: "meta_ads_package",
    artifact: {
      artifactId: "zip",
      filename: "project_meta-ads-package.zip",
      format: "zip",
      mediaType: "application/zip",
      byteSize: zip.length,
      checksum: zipChecksum,
      backingRef: zipRef,
      status: "available",
    },
    manifest: { familyId: operational.familyId },
    status: "ready",
    createdAt: new Date().toISOString(),
  });
const blobB = new MemoryProductionArtifactStore(blobData),
  restoredExport = await coldRepo.getExport(
    "operational",
    exportRecord.exportSessionId,
  ),
  restoredZip =
    restoredExport &&
    (await blobB.get(restoredExport.artifact.backingRef, "operational"));
assert(restoredZip);
assert.deepEqual(inspectProductionZip(restoredZip), [
  "manifest.json",
  "project_1.91x1.png",
  "project_1x1.png",
  "project_4x5.png",
  "project_9x16.png",
]);
assert.equal(
  (await coldRepo.saveExport(exportRecord)).exportSessionId,
  exportRecord.exportSessionId,
);
const missingBlobStore = new MemoryProductionArtifactStore(new Map());
assert.equal(
  await missingBlobStore.exists(
    restoredExport.artifact.backingRef,
    "operational",
  ),
  false,
);
const unavailable = await coldRepo.saveExport({
  ...restoredExport,
  status: "unavailable",
  artifact: { ...restoredExport.artifact, status: "unavailable" },
});
assert.equal(unavailable.status, "unavailable");
assert.equal(operationalDb.exports.length, 1);
console.log(
  "Operational family PASS: 3/4 partial, isolated retry, four durable variant authority links, transactional 4/4 authority and cold-start restore.",
);

const correctionDb = createMockCampaignDatabase(),
  correctionRepo = new MockCampaignFamilyRepository(correctionDb),
  baseCorrection = createCampaignFamily({
    projectId: "correction",
    operationId: "correction",
    inputFingerprint: "correction-fp",
    invariants,
    estimatedCostUsd: 0.4,
    hardCapUsd: 0.75,
  });
let correctionFamily = await correctionRepo.create({
  ...baseCorrection,
  variants: baseCorrection.variants.map((variant) => ({
    ...variant,
    status: "layout_ready",
    layoutPlan: {
      schemaVersion: "1.0.0",
      layoutId: `layout_${variant.formatId}`,
      projectId: "correction",
      canvas: { width: variant.width, height: variant.height },
      format: { id: variant.formatId },
    },
    readiness: { ...variant.readiness, layout: true },
  })),
});
const renderCounts: Record<string, number> = {},
  authorityCounts: Record<string, number> = {};
let correctionJobs = 0;
const shared = { id: "shared", source: "generated", status: "available" },
  replacement = { id: "shared-v2", source: "generated", status: "available" };
const correctionEngines = {
  review: async ({ formatId }) => ({
    sessionId: `review_${formatId}`,
    readyForRender: true,
    reviewedDesignPackage: {},
    revisionRounds: [],
    cost: 0,
  }),
  render: async ({ review }) => {
    const formatId = review.sessionId.replace("review_", "");
    renderCounts[formatId] = (renderCounts[formatId] ?? 0) + 1;
    return {
      sessionId: `render_${formatId}_${renderCounts[formatId]}`,
      readiness: { missingRequiredAssets: [] },
      renderDocument: {
        scenes: [
          {
            assetManifest: {
              requirements: [
                {
                  assetRef: renderCounts[formatId] > 1 ? "shared-v2" : "shared",
                },
              ],
            },
          },
        ],
      },
    };
  },
  resolveAssets: async ({ render, registry }) => ({ render, registry }),
  qa: async ({ render, registry, correctionAllowed }) => {
    const formatId = render.sessionId.split("_").slice(1, -1).join("_"),
      correct = formatId === "meta_ads_story_reels" && correctionAllowed;
    if (correct) correctionJobs++;
    return {
      sessionId: `qa_${render.sessionId}`,
      inputFingerprint: `qa_${render.sessionId}`,
      outcome: "approved",
      visualApproved: true,
      approvedPackage: { visualApprovalStatus: "approved" },
      regenerationRounds: correct
        ? [
            {
              sourceAssetIds: ["shared"],
              sourceAssetChecksums: ["old-checksum"],
              newAssetIds: ["shared-v2"],
              newAssetChecksums: ["new-checksum"],
            },
          ]
        : [],
      finalAssetRegistry: correct
        ? { projectId: "correction", assets: [...registry.assets, replacement] }
        : registry,
      warnings: [],
      cost: 0,
    };
  },
  persistAuthority: async ({ variant }) => {
    authorityCounts[variant.formatId] =
      (authorityCounts[variant.formatId] ?? 0) + 1;
    return {
      authorityId: `authority_${variant.formatId}_${authorityCounts[variant.formatId]}`,
      fingerprint: `package_${variant.formatId}_${authorityCounts[variant.formatId]}`,
    };
  },
};
const corrected = await runCampaignFamily(
  {
    family: correctionFamily,
    currentFamilyFingerprint: "correction-fp",
    creative,
    sourceRegistry: { projectId: "correction", assets: [shared] },
  },
  { repository: correctionRepo, engines: correctionEngines },
);
assert.equal(correctionJobs, 1);
assert.equal(renderCounts.meta_ads_landscape, 1);
assert.equal(renderCounts.meta_ads_square, 2);
assert.equal(renderCounts.meta_ads_feed_portrait, 2);
assert.equal(corrected.family.status, "approved");
assert(
  corrected.family.dependencyGraph.generatedAssetLineage?.some(
    (item) =>
      item.supersedesAssetId === "shared" &&
      item.newChecksum === "new-checksum",
  ),
);
console.log(
  "Shared correction PASS: one immutable replacement rerendered dependent variants, preserved unrelated authority, and produced a new complete family authority.",
);
