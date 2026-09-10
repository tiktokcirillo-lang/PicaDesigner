import { Router } from "express";
import { analyzeReferenceImage } from "../../application/visual-intelligence/analyze-reference-image.js";
import { applicationBudgetStore as budgetStore } from "../../infrastructure/ai/budget/runtime-store.js";
import {
  AIAuthenticationError,
  AIBudgetExceededError,
  AIProviderError,
  AIRateLimitError,
  AISchemaError,
  AITimeoutError,
  AnalysisPipelineError,
  UnsupportedAIInputError,
  safeErrorMessage,
} from "../../infrastructure/ai/providers/errors.js";
import { loadOpenAIConfig } from "../../infrastructure/ai/providers/openai/config.js";
import { OpenAIProvider } from "../../infrastructure/ai/providers/openai/responses.js";
import type { VisualForensicsInput } from "../../domain/visual-forensics/index.js";
import {
  createReferenceIntelligence,
  type ReferenceSourceMetadata,
} from "../../application/reference-intelligence/index.js";
import {
  applicationProjectSourceAssetRepository,
  applicationProjectSourceAssetStore,
} from "../../infrastructure/source-assets/index.js";
import { reconcileProjectSourceAsset } from "../../application/source-assets/index.js";

export const createVisualForensicsRouter = (): Router => {
  const router = Router();
  router.post("/analyze", async (request, response) => {
    try {
      const body = request.body as Partial<VisualForensicsInput> & {
        projectId?: string;
        sourceAssetId?: string;
        imageMetadata?: Omit<ReferenceSourceMetadata, "mediaType">;
      };
      if ((!body.image && !body.sourceAssetId) || !body.projectId)
        return response
          .status(400)
          .json({ error: "sourceAssetId and projectId are required" });
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(body.projectId))
        return response.status(400).json({ error: "projectId is invalid" });
      let image = body.image,
        imageMetadata = body.imageMetadata;
      if (body.sourceAssetId) {
        const asset = await applicationProjectSourceAssetRepository.get(
          body.projectId,
          body.sourceAssetId,
        );
        if (!asset || asset.role !== "visual_reference")
          return response
            .status(404)
            .json({ error: "Visual reference is unavailable." });
        const effective = await reconcileProjectSourceAsset(
            asset,
            applicationProjectSourceAssetStore,
          ),
          bytes =
            effective.status === "available"
              ? await applicationProjectSourceAssetStore.get(
                  asset.backingRef,
                  body.projectId,
                )
              : undefined;
        if (!bytes)
          return response
            .status(409)
            .json({
              error:
                "O arquivo original da referência não está mais disponível.",
            });
        image = {
          kind: "base64",
          data: Buffer.from(bytes).toString("base64"),
          mediaType: asset.mediaType,
        };
        imageMetadata = {
          fileName: asset.originalFilename,
          fileSize: asset.byteSize,
          width: asset.width,
          height: asset.height,
          aspectRatio: asset.aspectRatio,
          imageFingerprint: asset.checksum,
        };
      }
      if (!image)
        return response
          .status(400)
          .json({ error: "Visual reference is required." });
      const config = loadOpenAIConfig();
      const provider = new OpenAIProvider(config);
      const session = await createReferenceIntelligence(
        {
          image,
          projectId: body.projectId,
          imageMetadata,
          analysisDepth: body.analysisDepth,
          semanticExclusions: body.semanticExclusions,
          context: body.context,
        },
        {
          analyze: (input) =>
            analyzeReferenceImage(
              { ...input, language: body.language },
              { provider, budgetStore, config },
            ),
        },
      );
      return response.json(session);
    } catch (error) {
      const status =
        error instanceof UnsupportedAIInputError
          ? 400
          : error instanceof AIAuthenticationError
            ? 401
            : error instanceof AIBudgetExceededError
              ? 402
              : error instanceof AIRateLimitError
                ? 429
                : error instanceof AITimeoutError
                  ? 504
                  : error instanceof AISchemaError ||
                      error instanceof AnalysisPipelineError
                    ? 422
                    : error instanceof AIProviderError
                      ? 500
                      : 500;
      return response.status(status).json({ error: safeErrorMessage(error) });
    }
  });
  return router;
};
