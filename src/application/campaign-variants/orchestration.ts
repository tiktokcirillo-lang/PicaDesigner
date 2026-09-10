import {
  createResponsiveLayoutFamilyFromPreset,
  META_ADS_FAMILY,
  type LayoutPlan,
} from "../../domain/layout-engine/index.js";
import type { ArtDirectionRoute } from "../../domain/creative-direction/index.js";
import type { BrandDNA } from "../../domain/brand-intelligence/index.js";
import {
  assertCampaignRoute,
  assertNativeLayouts,
  createCampaignFamily,
  deriveFamilyApproval,
  type CampaignFamilyRepository,
  type CampaignInvariantSet,
  type CampaignVariantFamily,
} from "../../domain/campaign-variants/index.js";
export interface CampaignVariantRunner {
  run(input: {
    family: CampaignVariantFamily;
    variant: CampaignVariantFamily["variants"][number];
    layout: LayoutPlan;
    route: ArtDirectionRoute;
  }): Promise<Partial<CampaignVariantFamily["variants"][number]>>;
}
export async function ensureCampaignVariantFamily(
  input: {
    projectId: string;
    operationId: string;
    inputFingerprint: string;
    expectedProjectRevision: number;
    invariants: CampaignInvariantSet;
    primaryLayout: LayoutPlan;
    route: ArtDirectionRoute;
    brand?: BrandDNA;
    primaryFormatId?: string;
    estimatedCostUsd: number;
    hardCapUsd: number;
  },
  deps: {
    repository: CampaignFamilyRepository;
    runner?: CampaignVariantRunner;
  },
) {
  const prior = await deps.repository.findByOperation(
    input.projectId,
    input.operationId,
  );
  if (prior) {
    if (prior.inputFingerprint !== input.inputFingerprint)
      throw new Error("Campaign operation fingerprint conflict.");
    return { family: prior, cacheHit: true };
  }
  assertCampaignRoute(input.route, input.invariants);
  let family = createCampaignFamily(input);
  family = await deps.repository.create(family, input.expectedProjectRevision);
  if (!family.executionPlan.withinHardCap) return { family, cacheHit: false };
  const layouts = createResponsiveLayoutFamilyFromPreset(
    input.primaryLayout,
    META_ADS_FAMILY,
    input.route,
    input.brand,
  ).variants;
  assertNativeLayouts(layouts, family.primaryFormatId);
  family = {
    ...family,
    status: "running",
    variants: family.variants.map((variant) => {
      const layout = layouts.find((x) => x.format.id === variant.formatId)!;
      return {
        ...variant,
        status: "layout_ready",
        layoutSessionId: layout.layoutId,
        layoutPlan: layout,
        lineage: {
          ...variant.lineage,
          sourceLayoutId: input.primaryLayout.layoutId,
          layoutSessionId: layout.layoutId,
          provenance: [
            ...variant.lineage.provenance,
            ...layout.provenance.map((x) => x.source),
          ],
        },
        readiness: { ...variant.readiness, layout: true },
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  if (deps.runner) {
    for (const variant of family.variants) {
      if (variant.status === "approved") continue;
      try {
        const patch = await deps.runner.run({
          family,
          variant,
          layout: variant.layoutPlan!,
          route: input.route,
        });
        family = {
          ...family,
          variants: family.variants.map((x) =>
            x.variantId === variant.variantId
              ? { ...x, ...patch, updatedAt: new Date().toISOString() }
              : x,
          ),
        };
      } catch (error) {
        family = {
          ...family,
          variants: family.variants.map((x) =>
            x.variantId === variant.variantId
              ? {
                  ...x,
                  status: "failed",
                  warnings: [
                    ...x.warnings,
                    error instanceof Error
                      ? error.message
                      : "Variant execution failed.",
                  ],
                }
              : x,
          ),
        };
      }
    }
  }
  const approval = deriveFamilyApproval(family);
  family = {
    ...family,
    approval,
    status: approval.metaAdsPackageReady
      ? "approved"
      : family.variants.some((x) => x.status === "approved")
        ? "partial"
        : family.variants.some(
              (x) => x.status === "failed" || x.status === "blocked",
            )
          ? "partial"
          : "running",
    updatedAt: new Date().toISOString(),
  };
  return {
    family: await deps.repository.save(family, family.revision),
    cacheHit: false,
  };
}
export async function retryCampaignVariant(
  input: { projectId: string; familyId: string; formatId: string },
  deps: {
    repository: CampaignFamilyRepository;
    runner: CampaignVariantRunner;
    route: ArtDirectionRoute;
  },
) {
  const family = await deps.repository.get(input.projectId, input.familyId);
  if (!family) throw new Error("Campaign family not found.");
  const variant = family.variants.find((x) => x.formatId === input.formatId);
  if (!variant) throw new Error("Campaign variant not found.");
  if (variant.status === "approved") return family;
  assertCampaignRoute(deps.route, family.invariants);
  const patch = await deps.runner.run({
      family,
      variant,
      layout: variant.layoutPlan!,
      route: deps.route,
    }),
    variants = family.variants.map((x) =>
      x.variantId === variant.variantId
        ? { ...x, ...patch, updatedAt: new Date().toISOString() }
        : x,
    ),
    next = {
      ...family,
      variants,
      approval: deriveFamilyApproval({ ...family, variants }),
      updatedAt: new Date().toISOString(),
    };
  return deps.repository.save(next, family.revision);
}
