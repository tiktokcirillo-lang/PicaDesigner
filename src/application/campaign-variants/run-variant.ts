import type { ArtDirectorReviewSession } from "../../domain/art-director-review/index.js";
import type { BrandIntelligenceSession } from "../../domain/brand-intelligence/index.js";
import type { CreativeDirectionSession } from "../../domain/creative-direction/index.js";
import type { ImageAssetSession } from "../../domain/image-assets/index.js";
import type {
  LayoutIntelligenceSession,
  LayoutPlan,
} from "../../domain/layout-engine/index.js";
import type { PostRenderReviewSession } from "../../domain/post-render-review/index.js";
import type { ProductionAuthorityRecord } from "../../domain/project-persistence/index.js";
import type {
  ProjectAssetRegistry,
  RenderSession,
} from "../../domain/render-engine/index.js";
import type {
  CampaignVariant,
  CampaignVariantFamily,
} from "../../domain/campaign-variants/index.js";
import type { ReferenceIntelligenceSession } from "../reference-intelligence/index.js";
export interface CampaignVariantEngineAdapters {
  review(input: {
    projectId: string;
    creative: CreativeDirectionSession;
    layout: LayoutIntelligenceSession;
    brand?: BrandIntelligenceSession;
    reference?: ReferenceIntelligenceSession;
    formatId: string;
  }): Promise<ArtDirectorReviewSession>;
  render(input: {
    projectId: string;
    review: ArtDirectorReviewSession;
    registry: ProjectAssetRegistry;
    existing?: RenderSession;
  }): Promise<RenderSession>;
  resolveAssets(input: {
    projectId: string;
    review: ArtDirectorReviewSession;
    render: RenderSession;
    registry: ProjectAssetRegistry;
    existing?: ImageAssetSession;
  }): Promise<{
    render: RenderSession;
    registry: ProjectAssetRegistry;
    session?: ImageAssetSession;
  }>;
  qa(input: {
    projectId: string;
    review: ArtDirectorReviewSession;
    render: RenderSession;
    assets?: ImageAssetSession;
    registry: ProjectAssetRegistry;
    existing?: PostRenderReviewSession;
    correctionAllowed: boolean;
  }): Promise<PostRenderReviewSession>;
  persistAuthority(input: {
    family: CampaignVariantFamily;
    variant: CampaignVariant;
    qa: PostRenderReviewSession;
  }): Promise<ProductionAuthorityRecord>;
}
const layoutSession = (
  family: CampaignVariantFamily,
  variant: CampaignVariant,
  layout: LayoutPlan,
): LayoutIntelligenceSession => ({
  schemaVersion: layout.schemaVersion,
  sessionId: `campaign_layout_${variant.inputFingerprint.slice(0, 20)}`,
  projectId: family.projectId,
  createdAt: variant.updatedAt,
  inputFingerprint: variant.inputFingerprint,
  layoutDocument: {
    documentId: `campaign_document_${variant.variantId}`,
    projectId: family.projectId,
    formatFamily: family.familyDefinitionId,
    frames: [layout],
    keepTogetherGroups: [],
  },
  selectedLayoutId: layout.layoutId,
  quality: layout.quality,
  warnings: layout.warnings,
  status: "ready",
  sourceVersions: {
    creativeDirection: "shared",
    layoutSchema: layout.schemaVersion,
  },
  cost: 0,
});
export async function runCampaignVariant(
  input: {
    family: CampaignVariantFamily;
    variant: CampaignVariant;
    creative: CreativeDirectionSession;
    brand?: BrandIntelligenceSession;
    reference?: ReferenceIntelligenceSession;
    registry: ProjectAssetRegistry;
    existing?: {
      render?: RenderSession;
      assets?: ImageAssetSession;
      qa?: PostRenderReviewSession;
    };
    correctionAllowed: boolean;
  },
  engines: CampaignVariantEngineAdapters,
) {
  if (
    input.variant.status === "approved" &&
    input.variant.productionAuthorityId
  )
    return { variant: input.variant, cacheHit: true, registry: input.registry };
  if (
    input.creative.selectedRouteId !==
      input.family.invariants.selectedCreativeRouteId ||
    input.creative.sessionId !==
      input.family.invariants.creativeDirectionSessionId
  )
    throw new Error("campaign_upstream_revision_required");
  const layout = input.variant.layoutPlan;
  if (!layout) throw new Error("Variant native layout is unavailable.");
  const review = await engines.review({
    projectId: input.family.projectId,
    creative: input.creative,
    layout: layoutSession(input.family, input.variant, layout),
    brand: input.brand,
    reference: input.reference,
    formatId: input.variant.formatId,
  });
  if (!review.readyForRender || !review.reviewedDesignPackage) {
    const upstream = review.revisionRounds.some(
      (round) =>
        round.scope === "creative_adjustment" ||
        round.scope === "route_reselection" ||
        round.scope === "mixed",
    );
    return {
      variant: {
        ...input.variant,
        status: "blocked" as const,
        warnings: [
          ...input.variant.warnings,
          upstream
            ? "campaign_upstream_revision_required"
            : "pre_render_review_blocked",
        ],
        reviewSessionId: review.sessionId,
        lineage: {
          ...input.variant.lineage,
          reviewSessionId: review.sessionId,
        },
        updatedAt: new Date().toISOString(),
      },
      cacheHit: false,
      registry: input.registry,
      review,
    };
  }
  const render = await engines.render({
      projectId: input.family.projectId,
      review,
      registry: input.registry,
      existing: input.existing?.render,
    }),
    resolved = await engines.resolveAssets({
      projectId: input.family.projectId,
      review,
      render,
      registry: input.registry,
      existing: input.existing?.assets,
    });
  if (resolved.render.readiness.missingRequiredAssets.length)
    return {
      variant: {
        ...input.variant,
        status: "blocked" as const,
        reviewSessionId: review.sessionId,
        renderSessionId: resolved.render.sessionId,
        imageAssetSessionId: resolved.session?.sessionId,
        previewRenderSession: resolved.render,
        previewImageAssetSession: resolved.session,
        readiness: {
          layout: true,
          review: true,
          render: true,
          assets: false,
          visualQa: false,
          authority: false,
          blockers: ["required_assets_unresolved"],
        },
        warnings: [...input.variant.warnings, "required_assets_unresolved"],
        lineage: {
          ...input.variant.lineage,
          reviewSessionId: review.sessionId,
          renderSessionId: resolved.render.sessionId,
          imageAssetSessionId: resolved.session?.sessionId,
        },
        updatedAt: new Date().toISOString(),
      },
      cacheHit: false,
      registry: resolved.registry,
      review,
      render: resolved.render,
      assets: resolved.session,
    };
  const qa = await engines.qa({
    projectId: input.family.projectId,
    review,
    render: resolved.render,
    assets: resolved.session,
    registry: resolved.registry,
    existing: input.existing?.qa,
    correctionAllowed: input.correctionAllowed,
  });
  if (!qa.visualApproved || !qa.approvedPackage)
    return {
      variant: {
        ...input.variant,
        status:
          qa.outcome === "upstream_revision_required" ? "blocked" : "failed",
        reviewSessionId: review.sessionId,
        renderSessionId: resolved.render.sessionId,
        imageAssetSessionId: resolved.session?.sessionId,
        postRenderReviewSessionId: qa.sessionId,
        previewRenderSession: resolved.render,
        previewImageAssetSession: resolved.session,
        readiness: {
          layout: true,
          review: true,
          render: true,
          assets: true,
          visualQa: false,
          authority: false,
          blockers: [qa.outcome],
        },
        warnings: [...input.variant.warnings, qa.outcome],
        lineage: {
          ...input.variant.lineage,
          reviewSessionId: review.sessionId,
          renderSessionId: resolved.render.sessionId,
          imageAssetSessionId: resolved.session?.sessionId,
          postRenderReviewSessionId: qa.sessionId,
        },
        updatedAt: new Date().toISOString(),
      },
      cacheHit: false,
      registry: qa.finalAssetRegistry ?? resolved.registry,
      review,
      render: resolved.render,
      assets: resolved.session,
      qa,
    };
  const authority = await engines.persistAuthority({
    family: input.family,
    variant: input.variant,
    qa,
  });
  return {
    variant: {
      ...input.variant,
      status: "approved" as const,
      reviewSessionId: review.sessionId,
      renderSessionId: resolved.render.sessionId,
      imageAssetSessionId: resolved.session?.sessionId,
      postRenderReviewSessionId: qa.sessionId,
      productionAuthorityId: authority.authorityId,
      visualApprovedPackageFingerprint: authority.fingerprint,
      previewRenderSession: resolved.render,
      previewImageAssetSession: resolved.session,
      readiness: {
        layout: true,
        review: true,
        render: true,
        assets: true,
        visualQa: true,
        authority: true,
        blockers: [],
      },
      lineage: {
        ...input.variant.lineage,
        reviewSessionId: review.sessionId,
        renderSessionId: resolved.render.sessionId,
        imageAssetSessionId: resolved.session?.sessionId,
        postRenderReviewSessionId: qa.sessionId,
        productionAuthorityId: authority.authorityId,
        provenance: [
          ...input.variant.lineage.provenance,
          "senior_art_director_review",
          "deterministic_render",
          "pixel_visual_qa",
          "production_authority",
        ],
      },
      updatedAt: new Date().toISOString(),
    },
    cacheHit: false,
    registry: qa.finalAssetRegistry ?? resolved.registry,
    review,
    render: resolved.render,
    assets: resolved.session,
    qa,
    authority,
  };
}
