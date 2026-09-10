import type {
  AssetRequirement,
  ProjectAssetRegistry,
  RenderSession,
} from "../render-engine/index.js";
import type {
  CampaignAssetPlan,
  CampaignAssetPlanItem,
  CampaignVariantDependencyGraph,
} from "./types.js";
export function planCampaignAssets(
  familyId: string,
  renders: Array<{ variantId: string; render: RenderSession }>,
  registry: ProjectAssetRegistry,
): CampaignAssetPlan {
  const groups = new Map<
    string,
    Array<{ variantId: string; requirement: AssetRequirement }>
  >();
  for (const entry of renders)
    for (const scene of entry.render.renderDocument.scenes)
      for (const requirement of scene.assetManifest.requirements) {
        const key = `${requirement.role}:${requirement.visualIntent}`;
        groups.set(key, [
          ...(groups.get(key) ?? []),
          { variantId: entry.variantId, requirement },
        ]);
      }
  const items: CampaignAssetPlanItem[] = [];
  for (const [key, entries] of groups) {
    const exact = registry.assets.find(
        (asset) =>
          asset.status === "available" &&
          entries.every(({ requirement }) =>
            requirement.sourcePreference.includes(asset.source),
          ),
      ),
      ratios = entries.map(
        ({ requirement }) =>
          requirement.targetRect.width / requirement.targetRect.height,
      ),
      cropViable = Math.max(...ratios) / Math.min(...ratios) <= 2.2,
      policy = exact
        ? cropViable
          ? "responsive_crop"
          : "format_specific"
        : cropViable
          ? "shared"
          : "format_specific";
    items.push({
      requirementKey: key,
      variantIds: [...new Set(entries.map((x) => x.variantId))],
      policy,
      reuseAssetId: exact?.id,
      generationJobKey: exact
        ? undefined
        : policy === "format_specific"
          ? undefined
          : `campaign_asset_${familyId}_${key}`,
      cropViable,
      reason: exact
        ? "existing_asset_reuse"
        : cropViable
          ? "shared_generation_crop_viable"
          : "variant_crop_incompatible",
    });
  }
  const jobs = items.reduce(
      (n, item) =>
        n +
        (item.reuseAssetId
          ? 0
          : item.policy === "format_specific"
            ? item.variantIds.length
            : 1),
      0,
    ),
    reused = items.filter((x) => x.reuseAssetId).length;
  return {
    familyId,
    items,
    assetDependencies: Object.fromEntries(
      items
        .filter((x) => x.reuseAssetId)
        .map((x) => [x.reuseAssetId!, x.variantIds]),
    ),
    generationJobs: jobs,
    reuseRate: items.length ? reused / items.length : 1,
  };
}
export const createDependencyGraph = (
  assetPlan: CampaignAssetPlan,
  variants: Array<{
    variantId: string;
    layoutSessionId?: string;
    renderSessionId?: string;
    postRenderReviewSessionId?: string;
    productionAuthorityId?: string;
  }>,
): CampaignVariantDependencyGraph => ({
  sourceAssets: Object.fromEntries(
    assetPlan.items
      .filter((x) => x.reuseAssetId)
      .map((x) => [x.reuseAssetId!, x.variantIds]),
  ),
  generatedAssets: Object.fromEntries(
    assetPlan.items
      .filter((x) => x.generationJobKey)
      .map((x) => [x.generationJobKey!, x.variantIds]),
  ),
  variants: Object.fromEntries(
    variants.map((x) => [
      x.variantId,
      {
        layoutId: x.layoutSessionId,
        renderId: x.renderSessionId,
        qaId: x.postRenderReviewSessionId,
        authorityId: x.productionAuthorityId,
      },
    ]),
  ),
});
