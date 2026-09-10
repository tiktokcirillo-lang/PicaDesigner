import { Router } from "express";
import {
  ensurePostRenderReview,
  executeVisualCorrectionLoop,
  type EnsurePostRenderReviewRequest,
} from "../../application/post-render-review/index.js";
import {
  OpenAIProvider,
  ProjectAIBudgetCoordinator,
  applicationBudgetStore,
  createOpenAIClient,
  loadOpenAIConfig,
} from "../../infrastructure/ai/index.js";
import {
  MockImageGenerationProvider,
  OpenAIImageGenerationProvider,
  applicationGeneratedAssetStore,
} from "../../infrastructure/image-generation/index.js";
import {
  BudgetedPostRenderVisualQaProvider,
  MockPostRenderVisualQaProvider,
  OpenAIPostRenderVisualQaProvider,
  ResvgCompositeRasterizer,
} from "../../infrastructure/post-render-review/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import {
  PersistenceError,
  ProductionAuthorityPersistenceError,
} from "../../domain/project-persistence/index.js";
import { resolveProjectSourceRegistry } from "../../application/source-assets/index.js";
import { mergeProjectAssetRegistries } from "../../domain/source-assets/index.js";
import {
  applicationProjectSourceAssetRepository,
  applicationProjectSourceAssetStore,
  createCompositeAssetStore,
} from "../../infrastructure/source-assets/index.js";

export const createVisualQaRouter = () => {
  const router = Router();
  router.post("/review", async (req, res) => {
    try {
      if ("prompt" in (req.body ?? {}))
        return res
          .status(400)
          .json({ error: "Arbitrary QA prompts are not accepted." });
      const incoming = req.body as EnsurePostRenderReviewRequest,
        source = await resolveProjectSourceRegistry(
          incoming.projectId,
          incoming.sourceAssetIds ?? [],
          applicationProjectSourceAssetRepository,
          applicationProjectSourceAssetStore,
        ),
        body: EnsurePostRenderReviewRequest = {
          ...incoming,
          assetRegistry: mergeProjectAssetRegistries(
            source.registry,
            incoming.assetRegistry,
          ),
        },
        config = loadOpenAIConfig(),
        mock = (process.env.AI_VISUAL_QA_PROVIDER ?? "openai") === "mock",
        model = config.postRenderQaModel;
      const raw = mock
          ? new MockPostRenderVisualQaProvider(
              (process.env.AI_VISUAL_QA_MOCK_SCENARIO ?? "approved") as never,
            )
          : new OpenAIPostRenderVisualQaProvider(
              new OpenAIProvider(config),
              model,
              config.postRenderQaMaxImages,
            ),
        coordinator = new ProjectAIBudgetCoordinator(applicationBudgetStore, {
          projectLimitUsd: config.maxProjectCostUsd,
          monthlyLimitUsd: config.monthlyBudgetUsd,
          safetyFactor: config.budgetReservationSafetyFactor,
          ttlSeconds: config.budgetReservationTtlSeconds,
        }),
        provider = new BudgetedPostRenderVisualQaProvider(
          raw,
          coordinator,
          String(body.projectId),
          model,
          config.postRenderQaTargetUsd,
          config.postRenderQaMaxUsd,
          config.postRenderQaMaxImages,
        ),
        rasterizer = new ResvgCompositeRasterizer();
      const compositeStore = createCompositeAssetStore(
        applicationGeneratedAssetStore,
        applicationProjectSourceAssetStore,
      );
      const initial = await ensurePostRenderReview(body, {
        store: compositeStore,
        rasterizer,
        provider,
        model,
        estimatedCostUsd: config.postRenderQaTargetUsd,
        maxImages: config.postRenderQaMaxImages,
      });
      const respond = async (session: typeof initial) => {
        if (session.visualApproved && session.approvedPackage) {
          try {
            await applicationProjectRepository.createProject({
              projectId: session.projectId,
              operationId: `create:${session.projectId}`,
            });
            const current = await applicationProjectRepository.getProject(
              session.projectId,
            );
            if (!current) throw new Error("Durable project unavailable.");
            const checkpoint =
                await applicationProjectRepository.saveWorkflowCheckpoint({
                  projectId: session.projectId,
                  versionId:
                    session.approvedPackage.renderSession
                      .reviewedDesignPackageRef,
                  stage: "post_render_review",
                  operationId: `post-render:${session.sessionId}`,
                  fingerprint: session.inputFingerprint,
                  expectedRevision: current.revision,
                  payload: session,
                }),
              updated = await applicationProjectRepository.getProject(
                session.projectId,
              );
            if (!updated) throw new Error("Durable project unavailable.");
            await applicationProjectRepository.saveProductionAuthority({
              projectId: session.projectId,
              versionId: checkpoint.versionId,
              operationId: `authority:${session.sessionId}`,
              fingerprint: session.inputFingerprint,
              expectedRevision: updated.revision,
              postRenderReview: session,
              visualApprovedPackage: session.approvedPackage,
            });
          } catch (error) {
            if (error instanceof PersistenceError) throw error;
            throw new ProductionAuthorityPersistenceError(
              "Durable production authority save failed.",
            );
          }
        }
        const safeSession = JSON.parse(
          JSON.stringify(session, (key, value) =>
            key === "backingRef" &&
            typeof value === "string" &&
            value.startsWith("source-private://")
              ? undefined
              : value,
          ),
        );
        return res.json(
          req.query.debug === "qa"
            ? {
                ...safeSession,
                debugQa: {
                  pixelTargetsSent:
                    session.qaPlan.assetTargets.length +
                    (session.qaPlan.compositeTarget ? 1 : 0),
                  batchCount: session.qaPlan.batches.length,
                  targetIds: session.qaPlan.batches,
                  assetCoverage: session.qaPlan.assetTargets.map((target) => ({
                    targetId: target.id,
                    pixelProvided: target.pixelProvided,
                  })),
                  compositeCoverage: Boolean(
                    session.qaPlan.compositeTarget?.pixelProvided,
                  ),
                  partialCoverageWarning:
                    session.finalReview?.strengths.includes(
                      "partial_visual_coverage",
                    ) ?? false,
                },
              }
            : safeSession,
        );
      };
      if (initial.outcome !== "partial" || !body.imageAssetSession)
        return respond(initial);
      const imageProvider = mock
          ? new MockImageGenerationProvider()
          : new OpenAIImageGenerationProvider(
              createOpenAIClient(config),
              config.imageEstimatedCostUsd,
            ),
        verificationRaw = mock
          ? new MockPostRenderVisualQaProvider(
              (process.env.AI_VISUAL_QA_VERIFICATION_SCENARIO ??
                "regeneration_success") as never,
            )
          : new OpenAIPostRenderVisualQaProvider(
              new OpenAIProvider(config),
              model,
              config.postRenderQaMaxImages,
            ),
        verification = new BudgetedPostRenderVisualQaProvider(
          verificationRaw,
          coordinator,
          body.projectId,
          model,
          config.postRenderQaTargetUsd,
          config.postRenderQaMaxUsd,
          config.postRenderQaMaxImages,
        ),
        result = await executeVisualCorrectionLoop(
          initial,
          {
            reviewedDesignPackage: body.reviewedDesignPackage,
            imageAssetSession: body.imageAssetSession,
            assetRegistry: body.assetRegistry,
          },
          {
            store: compositeStore,
            imageProvider,
            qaProvider: verification,
            rasterizer,
            budget: coordinator,
            imageModel: mock ? "mock-image" : config.imageModel,
            regenLimitUsd: config.imageRegenerationMaxUsd,
            verificationReserveUsd: config.postRenderQaTargetUsd,
            maxRounds: config.postRenderMaxRegenerationRounds,
            maxMb: config.generatedImageMaxMb,
            storageRetries: config.assetStorageMaxRetries,
          },
        );
      return respond(result);
    } catch (error) {
      if (error instanceof PersistenceError)
        return res
          .status(503)
          .json({ error: "Durable production authority could not be saved." });
      return res.status(422).json({
        error: error instanceof Error ? error.message : "Visual QA failed.",
      });
    }
  });
  return router;
};
