import { createHash } from "node:crypto";
import {
  META_ADS_FAMILY,
  resolveFormatDefinition,
  type LayoutPlan,
} from "../layout-engine/index.js";
import {
  validateProductionFamily,
  type ApprovedProductionFamily,
} from "../export-engine/index.js";
import type {
  ArtDirectionRoute,
  CreativeDirectionSession,
} from "../creative-direction/index.js";
import type {
  CampaignFamilyApproval,
  CampaignFamilyVisualReview,
  CampaignInvariantSet,
  CampaignVariant,
  CampaignVariantFamily,
} from "./types.js";
export function evaluateCampaignFamilyConsistency(
  family: CampaignVariantFamily,
): CampaignFamilyVisualReview {
  const upstream =
      family.warnings.includes("campaign_upstream_revision_required") ||
      family.variants.some((variant) =>
        variant.warnings.includes("upstream_revision_required"),
      ),
    variantReviews = family.variants.map((variant) => ({
      variantId: variant.variantId,
      formatId: variant.formatId,
      status:
        variant.status === "approved"
          ? ("approved" as const)
          : ("blocked" as const),
      qaSessionId: variant.postRenderReviewSessionId,
      findings: variant.warnings.map((issue) => ({
        variantId: variant.variantId,
        scope: issue.includes("upstream")
          ? ("campaign" as const)
          : ("variant" as const),
        issue,
      })),
    })),
    approved = variantReviews.filter(
      (variant) => variant.status === "approved",
    ).length,
    score = upstream ? 0 : approved / family.variants.length;
  return {
    variantReviews,
    familyConsistency: {
      campaignIdentityConsistency: score,
      creativeDeviceConsistency: score,
      messageHierarchyConsistency: score,
      brandConsistency: score,
      heroConsistency: score,
    },
    campaignIssues: upstream ? ["campaign_upstream_revision_required"] : [],
    status: upstream
      ? "blocked"
      : approved === family.variants.length
        ? "approved"
        : approved
          ? "partial"
          : "blocked",
  };
}
const canonical = (value: unknown): string =>
    JSON.stringify(value, (_, v) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
          )
        : v,
    ),
  hash = (value: unknown) =>
    createHash("sha256").update(canonical(value)).digest("hex");
export const campaignFingerprint = (input: unknown) => hash(input);
export function lockCampaignInvariants(input: {
  creative: CreativeDirectionSession;
  approvedCopy: string[];
  brandFingerprint?: string;
  brandDNA?: CampaignInvariantSet["brandDNA"];
  officialLogoChecksum?: string;
  sourceAssetChecksums?: string[];
}): CampaignInvariantSet {
  const route = input.creative.selectedRoute;
  if (!route || route.id !== input.creative.selectedRouteId)
    throw new Error("Selected creative route is required.");
  const brief = input.creative.communicationBrief,
    base = {
      selectedCreativeRouteId: route.id,
      creativeDirectionSessionId: input.creative.sessionId,
      creativeConcept: route.concept.coreIdea,
      creativeDeviceIdentity: `${route.creativeDevice.name}:${route.creativeDevice.description}`,
      heroRole: route.heroStrategy,
      primaryMessage: brief.primaryMessage.value,
      approvedCopyContent: [...input.approvedCopy],
      ctaContent: brief.cta?.value,
      mandatoryContent: brief.mandatoryContent.map((x) => x.value),
      brandFingerprint: input.brandFingerprint,
      brandDNA: input.brandDNA,
      officialLogoChecksum: input.officialLogoChecksum,
      sourceAssetChecksums: [...(input.sourceAssetChecksums ?? [])].sort(),
      campaignVisualIdentity: `${route.territory.name}:${route.brandExpression}`,
      majorHierarchyIntent: route.hierarchyStrategy,
    };
  return { ...base, fingerprint: hash(base) };
}
export const createCampaignFamily = (input: {
  projectId: string;
  operationId: string;
  inputFingerprint: string;
  invariants: CampaignInvariantSet;
  primaryFormatId?: string;
  estimatedCostUsd: number;
  hardCapUsd: number;
  now?: string;
}): CampaignVariantFamily => {
  const now = input.now ?? new Date().toISOString(),
    primary = input.primaryFormatId ?? "meta_ads_feed_portrait";
  if (!META_ADS_FAMILY.variants.includes(primary))
    throw new Error("Primary format is outside Meta Ads family.");
  const familyId = `campaign_family_${hash({ projectId: input.projectId, inputFingerprint: input.inputFingerprint, primary, policy: "1.0.0" }).slice(0, 24)}`,
    variants = META_ADS_FAMILY.variants.map((formatId) => {
      const f = resolveFormatDefinition(formatId),
        variantId = `${familyId}_${formatId}`;
      return {
        variantId,
        familyId,
        projectId: input.projectId,
        formatId,
        width: f.width,
        height: f.height,
        status: "pending",
        inputFingerprint: hash({
          family: input.inputFingerprint,
          formatId,
          canvas: [f.width, f.height],
        }),
        warnings: [],
        createdAt: now,
        updatedAt: now,
        lineage: {
          creativeDirectionSessionId:
            input.invariants.creativeDirectionSessionId,
          selectedCreativeRouteId: input.invariants.selectedCreativeRouteId,
          provenance: ["shared_creative_direction", "native_variant_layout"],
        },
        readiness: {
          layout: false,
          review: false,
          render: false,
          assets: false,
          visualQa: false,
          authority: false,
          blockers: [],
        },
      } as CampaignVariant;
    });
  return {
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    familyId,
    projectId: input.projectId,
    operationId: input.operationId,
    inputFingerprint: input.inputFingerprint,
    familyDefinitionId: "meta_ads_family",
    primaryFormatId: primary,
    status: input.estimatedCostUsd <= input.hardCapUsd ? "draft" : "blocked",
    invariants: input.invariants,
    variants,
    executionPlan: {
      familyId,
      primaryFormatId: primary,
      variantOrder: [...META_ADS_FAMILY.variants],
      sharedStages: [
        "workspace_input",
        "reference_intelligence",
        "brand_intelligence",
        "creative_direction",
      ],
      variantStages: [
        "layout",
        "art_director_review",
        "render",
        "asset_resolution",
        "visual_qa",
        "production_authority",
      ],
      estimatedCostUsd: input.estimatedCostUsd,
      correctionReserveUsd: 0.1,
      withinHardCap: input.estimatedCostUsd <= input.hardCapUsd,
    },
    dependencyGraph: { sourceAssets: {}, generatedAssets: {}, variants: {} },
    approval: {
      status:
        input.estimatedCostUsd <= input.hardCapUsd ? "pending" : "blocked",
      approvedVariantIds: [],
      missingFormatIds: [...META_ADS_FAMILY.variants],
      metaAdsPackageReady: false,
    },
    createdAt: now,
    updatedAt: now,
    revision: 1,
    warnings: [],
  };
};
export function assertNativeLayouts(
  layouts: LayoutPlan[],
  primaryFormatId: string,
) {
  if (
    layouts.length !== META_ADS_FAMILY.variants.length ||
    new Set(layouts.map((x) => x.layoutId)).size !== layouts.length
  )
    throw new Error("Each campaign variant requires an independent layout.");
  for (const id of META_ADS_FAMILY.variants) {
    const layout = layouts.find((x) => x.format.id === id),
      format = resolveFormatDefinition(id);
    if (
      !layout ||
      layout.canvas.width !== format.width ||
      layout.canvas.height !== format.height
    )
      throw new Error(`Invalid native layout for ${id}.`);
  }
  const primary = layouts.find((x) => x.format.id === primaryFormatId)!;
  for (const layout of layouts.filter((x) => x !== primary)) {
    if (
      !layout.responsiveMetadata ||
      !layout.provenance.some((x) => x.source === "responsive_reflow")
    )
      throw new Error("Responsive reflow provenance is required.");
    const signature = (x: LayoutPlan) =>
      x.elements.map((e) => [
        e.rect.x,
        e.rect.y,
        e.rect.width,
        e.rect.height,
        e.typographyToken,
      ]);
    if (canonical(signature(layout)) === canonical(signature(primary)))
      throw new Error("Crop-only/scaled campaign variant rejected.");
  }
}
export function deriveFamilyApproval(
  family: CampaignVariantFamily,
  production?: ApprovedProductionFamily,
): CampaignFamilyApproval {
  if (production) {
    const validation = validateProductionFamily(production),
      approved = production.variants
        .filter(
          (x) => x.visualApprovedPackage.visualApprovalStatus === "approved",
        )
        .map((x) => x.variantId);
    return {
      status: validation.metaAdsPackageReady
        ? "approved"
        : approved.length
          ? "partial"
          : "blocked",
      approvedVariantIds: approved,
      missingFormatIds: validation.missingVariants,
      metaAdsPackageReady: validation.metaAdsPackageReady,
    };
  }
  const approved = family.variants.filter((x) => x.status === "approved");
  const missing = META_ADS_FAMILY.variants.filter(
    (id) => !approved.some((x) => x.formatId === id),
  );
  return {
    status: missing.length
      ? approved.length
        ? "partial"
        : "pending"
      : "approved",
    approvedVariantIds: approved.map((x) => x.variantId),
    missingFormatIds: missing,
    metaAdsPackageReady: missing.length === 0,
  };
}
export const assertCampaignRoute = (
  route: ArtDirectionRoute,
  invariants: CampaignInvariantSet,
) => {
  if (route.id !== invariants.selectedCreativeRouteId)
    throw new Error("Campaign creative route divergence rejected.");
};
