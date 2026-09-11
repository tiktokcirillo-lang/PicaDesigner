import { analyzeDurableVisualReference } from "../../client/reference-intelligence.js";
import { ensureCreativeDirection } from "../../client/creative-direction.js";
import { ensureLayoutIntelligence } from "../../client/layout-intelligence.js";
import { ensureArtDirectorReview } from "../../client/art-director-review.js";
import { ensureRenderSession } from "../../client/render-session.js";
import { ensureImageAssets } from "../../client/image-assets.js";
import { ensurePostRenderReview } from "../../client/post-render-review.js";
import { saveDurableCheckpoint } from "../../client/project-persistence.js";
import {
  createCampaignFamily,
  runCampaignFamily,
} from "../../client/campaign-variants.js";
import { createBrandIntelligenceSession } from "../../domain/brand-intelligence/index.js";
import type {
  SafeProjectState,
  WorkflowStage,
} from "../../domain/project-persistence/index.js";
import type {
  WorkspaceDraft,
  PipelineStageId,
} from "../state/workspace-types.js";
import {
  fingerprintWorkspaceInput,
  formatContextFor,
  toWorkspaceInput,
} from "../state/workspace-logic.js";
type StageCallback = (stage: PipelineStageId) => void;
type Workflow = Record<string, unknown>;
export async function runDesignPipeline(input: {
  projectId: string;
  revision: number;
  draft: WorkspaceDraft;
  snapshot: SafeProjectState;
  onStage: StageCallback;
}) {
  let revision = input.revision,
    versionId = input.snapshot.activeVersionId ?? `version:${input.projectId}`;
  const workflow = input.snapshot.workflow as Workflow;
  const formatValue =
    input.draft.formatId === "custom"
      ? `${input.draft.customWidth ?? 1080}x${input.draft.customHeight ?? 1080}`
      : input.draft.formatId;
  const persist = async (
    stage: WorkflowStage,
    payload: unknown,
    fingerprint: string,
  ) => {
    const saved = await saveDurableCheckpoint({
      projectId: input.projectId,
      versionId,
      stage,
      operationId: `${stage}:${fingerprint}`,
      fingerprint,
      expectedRevision: revision,
      payload,
    });
    revision = saved.project.revision;
  };
  const workspaceInput = toWorkspaceInput(input.draft),
    workspaceFingerprint = await fingerprintWorkspaceInput(workspaceInput),
    sourceAssetIds = [
      input.draft.logoAsset,
      ...input.draft.productAssets,
      ...input.draft.brandPhotoAssets,
      ...input.draft.graphicAssets,
    ]
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
      .map((asset) => asset.assetId);
  input.onStage("preparation");
  await persist("workspace_input", workspaceInput, workspaceFingerprint);
  let reference = workflow.reference_intelligence;
  if (input.draft.referenceAsset) {
    input.onStage("reference");
    reference = await analyzeDurableVisualReference({
      sourceAsset: input.draft.referenceAsset,
      projectId: input.projectId,
      analysisDepth: input.draft.analysisDepth,
      existingSession: reference as Parameters<
        typeof analyzeDurableVisualReference
      >[0]["existingSession"],
    });
    if ((reference as { status?: string }).status !== "ready")
      throw new Error("A referência não atingiu qualidade suficiente.");
    await persist(
      "reference_intelligence",
      reference,
      (reference as { sessionId: string }).sessionId,
    );
  }
  input.onStage("creative");
  const brandInput = input.draft.brandEnabled
    ? {
        colors: [input.draft.primaryColor, input.draft.secondaryColor].filter(
          Boolean,
        ),
        headlineFont: input.draft.titleFont,
        bodyFont: input.draft.bodyFont,
        url: input.draft.brandUrl,
        logoAssets: input.draft.logoAsset
          ? [
              {
                id: input.draft.logoAsset.assetId,
                type: "logo" as const,
                mediaType: input.draft.logoAsset.mediaType,
                fileName: input.draft.logoAsset.filename,
                fingerprint: input.draft.logoAsset.checksum,
                source: "logo_asset" as const,
                verified: true,
              },
            ]
          : undefined,
        assets: [
          ...input.draft.graphicAssets,
          ...input.draft.brandPhotoAssets,
        ].map((asset) => ({
          id: asset.assetId,
          type: "graphic_asset" as const,
          mediaType: asset.mediaType,
          fileName: asset.filename,
          fingerprint: asset.checksum,
          source: "brand_asset" as const,
          verified: true,
        })),
      }
    : undefined;
  const brand = createBrandIntelligenceSession(
    brandInput,
    input.projectId,
    workflow.brand_intelligence as Parameters<
      typeof createBrandIntelligenceSession
    >[2],
  );
  await persist("brand_intelligence", brand, brand.inputFingerprint);
  const creative = await ensureCreativeDirection({
    projectId: input.projectId,
    copy: input.draft.copyText,
    format: formatValue,
    destinationTool: input.draft.destinationTool,
    tone: input.draft.tone,
    brandIntelligence: brand,
    referenceIntelligence: reference as Parameters<
      typeof ensureCreativeDirection
    >[0]["referenceIntelligence"],
    existingSession: workflow.creative_direction as Parameters<
      typeof ensureCreativeDirection
    >[0]["existingSession"],
  });
  await persist("creative_direction", creative, creative.sessionId);
  if (creative.status !== "ready")
    throw new Error(
      creative.failureReason === "insufficient_divergence"
        ? "As rotas criativas ficaram semelhantes demais."
        : creative.failureReason === "no_eligible_route"
          ? "Nenhuma rota passou pelos critérios de direção criativa."
          : "A geração das rotas criativas não passou pela validação estrutural.",
    );
  if (input.draft.formatId === "meta_ads_family") {
    input.onStage("layout");
    const campaign = await createCampaignFamily({
      projectId: input.projectId,
      expectedRevision: revision,
      operationId: `campaign:${workspaceFingerprint}`,
    });
    input.onStage("production");
    const executed = await runCampaignFamily(
      input.projectId,
      campaign.family.familyId,
    );
    input.onStage("qa");
    return { revision, campaign: executed.family, creative, brand, reference };
  }
  input.onStage("layout");
  const layout = await ensureLayoutIntelligence({
    projectId: input.projectId,
    creativeDirection: creative,
    brandIntelligence: brand,
    referenceIntelligence: reference as Parameters<
      typeof ensureLayoutIntelligence
    >[0]["referenceIntelligence"],
    format: formatValue,
    formatContext: formatContextFor(formatValue),
    destinationTool: input.draft.destinationTool,
    existingSession: workflow.layout as Parameters<
      typeof ensureLayoutIntelligence
    >[0]["existingSession"],
  });
  await persist("layout", layout, layout.sessionId);
  input.onStage("review");
  const review = await ensureArtDirectorReview({
    projectId: input.projectId,
    creativeDirection: creative,
    layoutIntelligence: layout,
    brandIntelligence: brand,
    referenceIntelligence: reference as Parameters<
      typeof ensureArtDirectorReview
    >[0]["referenceIntelligence"],
    format: formatValue,
    destinationTool: input.draft.destinationTool,
    existingReviewSession: workflow.art_director_review as Parameters<
      typeof ensureArtDirectorReview
    >[0]["existingReviewSession"],
  });
  await persist("art_director_review", review, review.sessionId);
  if (!review.readyForRender || !review.reviewedDesignPackage)
    throw new Error("A revisão de direção de arte bloqueou a produção.");
  versionId = review.sessionId;
  input.onStage("production");
  let render = await ensureRenderSession({
    projectId: input.projectId,
    reviewedDesignPackage: review.reviewedDesignPackage,
    assetRegistry: { projectId: input.projectId, assets: [] },
    destinationTool: input.draft.destinationTool,
    existingSession: workflow.render_session as Parameters<
      typeof ensureRenderSession
    >[0]["existingSession"],
    fontAvailability: ["Arial", "Helvetica", "sans-serif"],
    sourceAssetIds,
  });
  await persist("render_session", render, render.inputFingerprint);
  let imageAssets = workflow.image_asset_session as Parameters<
    typeof ensurePostRenderReview
  >[0]["imageAssetSession"];
  if (render.readiness.missingRequiredAssets.length) {
    imageAssets = await ensureImageAssets({
      projectId: input.projectId,
      reviewedDesignPackage: review.reviewedDesignPackage,
      renderSession: render,
      assetRegistry: {
        projectId: input.projectId,
        assets: imageAssets?.registry?.assets ?? [],
      },
      quality: "standard",
      fontAvailability: ["Arial", "Helvetica", "sans-serif"],
      sourceAssetIds,
    });
    render = imageAssets.renderSession;
    await persist("image_asset_session", imageAssets, imageAssets.sessionId);
  }
  input.onStage("qa");
  const qa = await ensurePostRenderReview({
    projectId: input.projectId,
    reviewedDesignPackage: review.reviewedDesignPackage,
    renderSession: render,
    imageAssetSession: imageAssets,
    assetRegistry: imageAssets?.registry ?? {
      projectId: input.projectId,
      assets: [],
    },
    existingSession: workflow.post_render_review as Parameters<
      typeof ensurePostRenderReview
    >[0]["existingSession"],
    sourceAssetIds,
  });
  if (imageAssets?.generatedAssets?.length && !qa.visualApproved)
    throw new Error("A revisão visual não aprovou a peça para produção.");
  return { revision, qa, render, layout, review, creative, brand, reference };
}
