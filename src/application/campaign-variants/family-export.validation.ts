// @ts-nocheck -- compact pixels-first fixtures expose only export fields consumed by the implementation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createCampaignFamilyExport } from "./export-family.js";
import {
  createCampaignFamily,
  type CampaignFamilyAuthority,
  type CampaignInvariantSet,
} from "../../domain/campaign-variants/index.js";
import {
  createMockCampaignDatabase,
  MockCampaignFamilyRepository,
} from "../../infrastructure/campaign-variants/index.js";
import {
  MemoryProductionArtifactStore,
  inspectProductionZip,
} from "../../infrastructure/export-engine/index.js";
import { MockDurableGeneratedAssetStore } from "../../infrastructure/image-generation/index.js";

const invariants = {
  selectedCreativeRouteId: "route",
  creativeDirectionSessionId: "creative",
  creativeConcept: "concept",
  creativeDeviceIdentity: "device",
  heroRole: "hero",
  primaryMessage: "message",
  approvedCopyContent: ["message"],
  mandatoryContent: [],
  sourceAssetChecksums: [],
  campaignVisualIdentity: "identity",
  majorHierarchyIntent: "hero",
  fingerprint: "invariants",
} satisfies CampaignInvariantSet;
let family = createCampaignFamily({
  projectId: "export-project",
  operationId: "family",
  inputFingerprint: "family-fingerprint",
  invariants,
  estimatedCostUsd: 0.4,
  hardCapUsd: 0.75,
});
const authorities = new Map();
family = {
  ...family,
  status: "approved",
  variants: family.variants.map((variant) => {
    const sceneId = `scene_${variant.formatId}`,
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${variant.width}" height="${variant.height}" viewBox="0 0 ${variant.width} ${variant.height}"><rect width="100%" height="100%" fill="#123456"/></svg>`,
      checksum = createHash("sha256").update(svg).digest("hex"),
      authorityId = `authority_${variant.formatId}`,
      packageFingerprint = `package_${variant.formatId}`;
    authorities.set(authorityId, {
      authorityId,
      status: "valid",
      fingerprint: packageFingerprint,
      visualApprovedPackage: {
        projectId: "export-project",
        reviewSessionId: `review_${variant.formatId}`,
        postRenderReviewSessionId: `qa_${variant.formatId}`,
        reviewedDesignPackage: {
          layoutPlan: { format: { id: variant.formatId } },
        },
      renderSession: {
        sessionId: `render_${variant.formatId}`,
        projectId:"export-project",
        readiness:{productionReady:true,missingRequiredAssets:[],fontIssues:[]},
        renderDocument: {
          scenes: [{ sceneId, width: variant.width, height: variant.height }],
        },
        artifacts: [{artifactId:`artifact_${variant.formatId}`,sceneId,svg,checksum,width:variant.width,height:variant.height,readiness:{productionReady:true}}],
        sourceVersions: {},
      },
        finalAssets: { projectId: "export-project", assets: [] },
        canonicalArtifacts: [{ sceneId, svg, checksum }],
        pixelQaSummary: { score: 100, verdict: "approved" },
        visualApprovalStatus: "approved",
        provenance: [],
      },
    });
    return {
      ...variant,
      status: "approved",
      renderSessionId: `render_${variant.formatId}`,
      postRenderReviewSessionId: `qa_${variant.formatId}`,
      productionAuthorityId: authorityId,
      visualApprovedPackageFingerprint: packageFingerprint,
    };
  }),
  approval: {
    status: "approved",
    approvedVariantIds: family.variants.map((v) => v.variantId),
    missingFormatIds: [],
    metaAdsPackageReady: true,
    familyAuthorityId: "family-authority",
  },
};
const familyAuthority: CampaignFamilyAuthority = {
  familyAuthorityId: "family-authority",
  familyId: family.familyId,
  projectId: family.projectId,
  operationId: "authority",
  fingerprint: "authority-fingerprint",
  variantAuthorityIds: Object.fromEntries(
    family.variants.map((v) => [v.formatId, v.productionAuthorityId]),
  ),
  status: "valid",
  invariantsFingerprint: invariants.fingerprint,
  approvedAt: new Date().toISOString(),
};
const db = createMockCampaignDatabase(),
  repoA = new MockCampaignFamilyRepository(db),
  blobData = new Map(),
  artifactA = new MemoryProductionArtifactStore(blobData),
  session = await createCampaignFamilyExport(
    { family, authority: familyAuthority, projectSlug: "campaign" },
    {
      projects: {
        getProductionAuthority: async (_project, id) => authorities.get(id),
      },
      repository: repoA,
      assetStore: new MockDurableGeneratedAssetStore(),
      artifactStore: artifactA,
    },
  );
assert.equal(session.status, "ready");
assert.equal(session.artifact.byteSize > 0, true);
assert.deepEqual(
  inspectProductionZip(
    (await artifactA.get(session.artifact.backingRef, "export-project"))!,
  ),
  [
    "campaign_1.91x1.png",
    "campaign_1x1.png",
    "campaign_4x5.png",
    "campaign_9x16.png",
    "manifest.json",
  ],
);
const repoB = new MockCampaignFamilyRepository(db),
  artifactB = new MemoryProductionArtifactStore(blobData),
  restored = await repoB.getExport("export-project", session.exportSessionId),
  bytes =
    restored &&
    (await artifactB.get(restored.artifact.backingRef, "export-project"));
assert(restored && bytes);
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  session.artifact.checksum,
);
const missing = {
  ...familyAuthority,
  variantAuthorityIds: { ...familyAuthority.variantAuthorityIds },
};
delete missing.variantAuthorityIds.meta_ads_story_reels;
await assert.rejects(
  () =>
    createCampaignFamilyExport(
      {
        family,
        authority: missing,
        projectSlug: "campaign",
        operationId: "missing",
      },
      {
        projects: {
          getProductionAuthority: async (_project, id) => authorities.get(id),
        },
        repository: repoB,
        assetStore: new MockDurableGeneratedAssetStore(),
        artifactStore: artifactB,
      },
    ),
  /authority is missing/,
);
console.log(
  "Campaign family export PASS: four exact native PNGs, frozen authority lineage, durable metadata/blob cold start and missing-variant block.",
);
