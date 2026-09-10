import { Router } from "express";
import {
  generateRequiredAssets,
  type GenerateRequiredAssetsRequest,
} from "../../application/image-assets/index.js";
import { resolveProjectSourceRegistry } from "../../application/source-assets/index.js";
import { mergeProjectAssetRegistries } from "../../domain/source-assets/index.js";
import type { ImageAssetSession } from "../../domain/image-assets/index.js";
import { ProjectAIBudgetCoordinator } from "../../infrastructure/ai/budget/project-coordinator.js";
import { applicationBudgetStore } from "../../infrastructure/ai/budget/runtime-store.js";
import { createOpenAIClient } from "../../infrastructure/ai/providers/openai/client.js";
import { loadOpenAIConfig } from "../../infrastructure/ai/providers/openai/config.js";
import {
  applicationGeneratedAssetStore,
  MockImageGenerationProvider,
  OpenAIImageGenerationProvider,
} from "../../infrastructure/image-generation/index.js";
import {
  applicationProjectSourceAssetRepository,
  applicationProjectSourceAssetStore,
} from "../../infrastructure/source-assets/index.js";
const safeSession = (session: ImageAssetSession): ImageAssetSession =>
  JSON.parse(
    JSON.stringify(session, (key, value) =>
      key === "backingRef" &&
      typeof value === "string" &&
      value.startsWith("source-private://")
        ? undefined
        : value,
    ),
  ) as ImageAssetSession;
export const createImageAssetsRouter = () => {
  const router = Router();
  router.post("/generate-required", async (req, res) => {
    try {
      if ("prompt" in (req.body ?? {}))
        return res
          .status(400)
          .json({ error: "Raw image prompts are not accepted." });
      const body = req.body as GenerateRequiredAssetsRequest,
        source = await resolveProjectSourceRegistry(
          body.projectId,
          body.sourceAssetIds ?? [],
          applicationProjectSourceAssetRepository,
          applicationProjectSourceAssetStore,
        ),
        assetRegistry = mergeProjectAssetRegistries(
          source.registry,
          body.assetRegistry,
        ),
        config = loadOpenAIConfig(),
        mock = (process.env.AI_IMAGE_PROVIDER ?? "openai") === "mock",
        provider = mock
          ? new MockImageGenerationProvider()
          : new OpenAIImageGenerationProvider(
              createOpenAIClient({
                ...config,
                requestTimeoutMs: config.imageRequestTimeoutMs,
                maxRetries: config.imageMaxRetries,
              }),
              config.imageEstimatedCostUsd,
            ),
        budget = new ProjectAIBudgetCoordinator(applicationBudgetStore, {
          projectLimitUsd: config.maxProjectCostUsd,
          monthlyLimitUsd: config.monthlyBudgetUsd,
          safetyFactor: config.budgetReservationSafetyFactor,
          ttlSeconds: config.budgetReservationTtlSeconds,
        });
      const result = await generateRequiredAssets(
        { ...body, assetRegistry },
        {
          provider,
          store: applicationGeneratedAssetStore,
          budget,
          model: mock ? "mock-image" : config.imageModel,
          targetUsd: config.imageGenerationTargetUsd,
          limitUsd: config.imageGenerationMaxUsd,
          maxMb: config.generatedImageMaxMb,
          production: process.env.NODE_ENV === "production" && !mock,
          storageMaxRetries: config.assetStorageMaxRetries,
        },
      );
      return res.json(safeSession(result));
    } catch (e) {
      return res
        .status(422)
        .json({
          error:
            e instanceof Error ? e.message : "Image asset generation failed.",
        });
    }
  });
  router.post("/read-handle", async (req, res) => {
    try {
      const { projectId, assetId, imageAssetSession } = req.body ?? {};
      if (
        !projectId ||
        imageAssetSession?.projectId !== projectId ||
        imageAssetSession?.sessionId?.length < 8
      )
        return res.status(403).json({ error: "Asset lineage is invalid." });
      const asset = imageAssetSession.registry?.assets?.find(
        (a: { id: string }) => a.id === assetId,
      );
      if (
        !asset?.backingRef ||
        !applicationGeneratedAssetStore.createReadHandle
      )
        return res.status(404).json({ error: "Asset is unavailable." });
      const config = loadOpenAIConfig(),
        handle = await applicationGeneratedAssetStore.createReadHandle(
          asset.backingRef,
          projectId,
          asset.mediaType,
          config.assetSignedUrlTtlSeconds,
        );
      return res.json(handle);
    } catch {
      return res.status(404).json({ error: "Asset is unavailable." });
    }
  });
  return router;
};
