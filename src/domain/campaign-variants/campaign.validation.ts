import assert from "node:assert/strict";
import {
  META_ADS_FAMILY,
  resolveFormatDefinition,
  type LayoutPlan,
} from "../layout-engine/index.js";
import {
  assertNativeLayouts,
  createCampaignFamily,
  deriveFamilyApproval,
  type CampaignInvariantSet,
} from "./index.js";
const invariants: CampaignInvariantSet = {
  selectedCreativeRouteId: "route",
  creativeDirectionSessionId: "creative",
  creativeConcept: "One idea",
  creativeDeviceIdentity: "signal",
  heroRole: "product",
  primaryMessage: "Approved message",
  approvedCopyContent: ["Approved message", "Buy now", "Legal"],
  ctaContent: "Buy now",
  mandatoryContent: ["Legal"],
  sourceAssetChecksums: ["product-checksum"],
  campaignVisualIdentity: "campaign",
  majorHierarchyIntent: "message-first",
  fingerprint: "invariants",
};
const family = createCampaignFamily({
  projectId: "project",
  operationId: "campaign:one",
  inputFingerprint: "input",
  invariants,
  estimatedCostUsd: 0.4,
  hardCapUsd: 0.75,
  now: "2026-01-01T00:00:00.000Z",
});
assert.equal(family.variants.length, 4);
assert.deepEqual(
  family.variants.map((v) => v.formatId),
  META_ADS_FAMILY.variants,
);
assert.deepEqual(
  family.variants.map((v) => [v.width, v.height]),
  [
    [1080, 1080],
    [1080, 1350],
    [1080, 1920],
    [1200, 628],
  ],
);
assert.equal(family.primaryFormatId, "meta_ads_feed_portrait");
const plans = META_ADS_FAMILY.variants.map((id, index) => {
  const format = resolveFormatDefinition(id);
  return {
    layoutId: `layout_${id}`,
    format,
    canvas: { width: format.width, height: format.height },
    elements: [
      {
        rect: {
          x: 0.05 + index * 0.01,
          y: 0.1 + index * 0.02,
          width: 0.7 - index * 0.03,
          height: 0.2 + index * 0.01,
        },
        typographyToken: "headline",
      },
    ],
    responsiveMetadata: index
      ? { sourceLayoutId: "layout_meta_ads_feed_portrait", invariants: [] }
      : undefined,
    provenance: index
      ? [{ source: "responsive_reflow", decision: "native" }]
      : [],
  } as unknown as LayoutPlan;
});
assertNativeLayouts(plans, "meta_ads_square");
assert.throws(
  () =>
    assertNativeLayouts(
      plans.map((p, index) =>
        index ? { ...p, elements: plans[0]!.elements } : p,
      ),
      "meta_ads_square",
    ),
  /scaled/,
);
const three = {
    ...family,
    variants: family.variants.map((v, i) => ({
      ...v,
      status: i < 3 ? ("approved" as const) : ("failed" as const),
    })),
  },
  partial = deriveFamilyApproval(three);
assert.equal(partial.metaAdsPackageReady, false);
assert.equal(partial.status, "partial");
const all = {
    ...family,
    variants: family.variants.map((v) => ({
      ...v,
      status: "approved" as const,
    })),
  },
  approved = deriveFamilyApproval(all);
assert(approved.metaAdsPackageReady);
assert.equal(approved.status, "approved");
const blocked = createCampaignFamily({
  projectId: "p",
  operationId: "o",
  inputFingerprint: "x",
  invariants,
  estimatedCostUsd: 0.76,
  hardCapUsd: 0.75,
});
assert.equal(blocked.status, "blocked");
console.log(
  "Campaign validation passed: canonical four formats, dimensions, native-layout gate, 4/4 approval and hard-cap preflight.",
);
