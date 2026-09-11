import { createLedger } from "../../infrastructure/ai/budget/budget-tracker.js";
import { BudgetedAIExecutor } from "../../infrastructure/ai/budget/executor.js";
import { applicationBudgetStore } from "../../infrastructure/ai/budget/runtime-store.js";
import { ProjectAIBudgetCoordinator } from "../../infrastructure/ai/budget/project-coordinator.js";
import { createOpenAIClient } from "../../infrastructure/ai/providers/openai/client.js";
import { loadOpenAIConfig } from "../../infrastructure/ai/providers/openai/config.js";
import { createStructuredAIProvider } from "../../infrastructure/ai/providers/factory.js";
import {
  createArtDirectorReview,
  OpenAISeniorArtDirectorCritic,
} from "../../application/art-director-review/index.js";
import { MockSeniorArtDirectorCritic } from "../../domain/art-director-review/index.js";
import { resolvePicaDesignerProviderMode } from "../../infrastructure/ai/provider-mode.js";
import { createRenderSession } from "../../application/render-engine/index.js";
import { generateRequiredAssets } from "../../application/image-assets/index.js";
import { type CampaignVariantEngineAdapters } from "../../application/campaign-variants/index.js";
import {
  ensurePostRenderReview,
  executeVisualCorrectionLoop,
} from "../../application/post-render-review/index.js";
import {
  applicationGeneratedAssetStore,
  MockImageGenerationProvider,
  OpenAIImageGenerationProvider,
} from "../../infrastructure/image-generation/index.js";
import {
  BudgetedPostRenderVisualQaProvider,
  MockPostRenderVisualQaProvider,
  OpenAIPostRenderVisualQaProvider,
  ResvgCompositeRasterizer,
} from "../../infrastructure/post-render-review/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import {
  createCompositeAssetStore,
  applicationProjectSourceAssetStore,
} from "../../infrastructure/source-assets/index.js";
import { assertPaidAISinkReadiness } from "./ai-readiness.js";
export interface CampaignRuntimeTestInstrumentation {
  mockImageProviderCalls: number;
  mockQaCalls: number;
  mockCriticCalls: number;
}
let testInstrumentation: CampaignRuntimeTestInstrumentation | undefined;
export const setCampaignRuntimeInstrumentationForTests = (
  instrumentation?: CampaignRuntimeTestInstrumentation,
): void => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Campaign runtime test instrumentation is forbidden in production.");
  testInstrumentation = instrumentation;
};
const stripBinaryMetadata = <T>(value: T): T => {
  const visit = (item: unknown): unknown => {
    if (item instanceof Uint8Array || item instanceof ArrayBuffer) return undefined;
    if (Array.isArray(item)) return item.map(visit).filter((entry) => entry !== undefined);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .map(([key, entry]) => [key, visit(entry)] as const)
          .filter(([, entry]) => entry !== undefined),
      );
    return item;
  };
  return visit(value) as T;
};
export async function createCampaignRuntimeAdapters(): Promise<CampaignVariantEngineAdapters> {
  await assertPaidAISinkReadiness();
  const config = loadOpenAIConfig(),
    e2eMock = resolvePicaDesignerProviderMode() === "mock",
    mockQa =
      e2eMock || (process.env.AI_VISUAL_QA_PROVIDER ?? "openai") === "mock",
    mockImage =
      e2eMock || (process.env.AI_IMAGE_PROVIDER ?? "openai") === "mock",
    coordinator = new ProjectAIBudgetCoordinator(applicationBudgetStore, {
      projectLimitUsd: config.maxProjectCostUsd,
      monthlyLimitUsd: config.monthlyBudgetUsd,
      safetyFactor: config.budgetReservationSafetyFactor,
      ttlSeconds: config.budgetReservationTtlSeconds,
    }),
    composite = createCompositeAssetStore(
      applicationGeneratedAssetStore,
      applicationProjectSourceAssetStore,
    );
  return {
    review: async ({
      projectId,
      creative,
      layout,
      brand,
      reference,
      formatId,
    }) => {
      if (e2eMock && testInstrumentation) testInstrumentation.mockCriticCalls += 1;
      const ledger =
          (await applicationBudgetStore.getProject(projectId)) ??
          createLedger(projectId),
        executor = e2eMock
          ? undefined
          : new BudgetedAIExecutor(
              createStructuredAIProvider({ config }),
              applicationBudgetStore,
              config.maxProjectCostUsd,
              ledger,
              Number.POSITIVE_INFINITY,
              {
                monthlyLimitUsd: config.monthlyBudgetUsd,
                safetyFactor: config.budgetReservationSafetyFactor,
                ttlSeconds: config.budgetReservationTtlSeconds,
                stage: "senior_critic",
                stageLimitUsd: Math.min(
                  config.maxProjectCostUsd,
                  config.seniorCriticMaxUsd * 2,
                ),
              },
            ),
        critic = e2eMock
          ? new MockSeniorArtDirectorCritic()
          : new OpenAISeniorArtDirectorCritic(executor!, config.forensicsModel);
      return createArtDirectorReview(
        {
          projectId,
          creativeDirection: creative,
          layoutIntelligence: layout,
          brandIntelligence: brand,
          referenceIntelligence: reference,
          format: formatId,
          destinationTool: "Canva",
        },
        critic,
      );
    },
    render: async ({ projectId, review, registry }) =>
      createRenderSession({
        projectId,
        reviewedDesignPackage: review.reviewedDesignPackage!,
        assetRegistry: registry,
        fontAvailability: ["Arial", "Helvetica", "sans-serif"],
      }),
    resolveAssets: async ({
      projectId,
      review,
      render,
      registry,
      existing,
    }) => {
      if (!render.readiness.missingRequiredAssets.length)
        return { render, registry, session: existing };
      const provider = mockImage
          ? new MockImageGenerationProvider()
          : new OpenAIImageGenerationProvider(
              createOpenAIClient({
                ...config,
                requestTimeoutMs: config.imageRequestTimeoutMs,
                maxRetries: config.imageMaxRetries,
              }),
              config.imageEstimatedCostUsd,
            ),
        session = await generateRequiredAssets(
          {
            projectId,
            reviewedDesignPackage: review.reviewedDesignPackage!,
            renderSession: render,
            assetRegistry: registry,
            quality: "standard",
            fontAvailability: ["Arial", "Helvetica", "sans-serif"],
          },
          {
            provider,
            store: applicationGeneratedAssetStore,
            budget: coordinator,
            model: mockImage ? "mock-image" : config.imageModel,
            targetUsd: config.imageGenerationTargetUsd,
            limitUsd: config.imageGenerationMaxUsd,
            maxMb: config.generatedImageMaxMb,
            production: process.env.NODE_ENV === "production" && !mockImage,
            storageMaxRetries: config.assetStorageMaxRetries,
          },
        );
      if (mockImage && testInstrumentation) testInstrumentation.mockImageProviderCalls += 1;
      return {
        render: session.renderSession,
        registry: session.registry,
        session,
      };
    },
    qa: async ({
      projectId,
      review,
      render,
      assets,
      registry,
      existing,
      correctionAllowed,
    }) => {
      if (mockQa && testInstrumentation) testInstrumentation.mockQaCalls += 1;
      const raw = mockQa
          ? new MockPostRenderVisualQaProvider(
              (process.env.AI_VISUAL_QA_MOCK_SCENARIO ?? "approved") as never,
            )
          : new OpenAIPostRenderVisualQaProvider(
              createStructuredAIProvider({ config }),
              config.postRenderQaModel,
              config.postRenderQaMaxImages,
            ),
        provider = new BudgetedPostRenderVisualQaProvider(
          raw,
          coordinator,
          projectId,
          config.postRenderQaModel,
          config.postRenderQaTargetUsd,
          Math.min(config.maxProjectCostUsd, config.postRenderQaMaxUsd * 4),
          config.postRenderQaMaxImages,
        ),
        rasterizer = new ResvgCompositeRasterizer(),
        initial = await ensurePostRenderReview(
          {
            projectId,
            reviewedDesignPackage: review.reviewedDesignPackage!,
            renderSession: render,
            imageAssetSession: assets,
            assetRegistry: registry,
            existingSession: existing,
          },
          {
            store: composite,
            rasterizer,
            provider,
            model: config.postRenderQaModel,
            estimatedCostUsd: config.postRenderQaTargetUsd,
            maxImages: config.postRenderQaMaxImages,
          },
        );
      if (initial.outcome !== "partial" || !assets || !correctionAllowed)
        return initial;
      const imageProvider = mockImage
          ? new MockImageGenerationProvider()
          : new OpenAIImageGenerationProvider(
              createOpenAIClient(config),
              config.imageEstimatedCostUsd,
            ),
        verificationRaw = mockQa
          ? new MockPostRenderVisualQaProvider(
              (process.env.AI_VISUAL_QA_VERIFICATION_SCENARIO ??
                "regeneration_success") as never,
            )
          : new OpenAIPostRenderVisualQaProvider(
              createStructuredAIProvider({ config }),
              config.postRenderQaModel,
              config.postRenderQaMaxImages,
            ),
        verification = new BudgetedPostRenderVisualQaProvider(
          verificationRaw,
          coordinator,
          projectId,
          config.postRenderQaModel,
          config.postRenderQaTargetUsd,
          Math.min(config.maxProjectCostUsd, config.postRenderQaMaxUsd * 4),
          config.postRenderQaMaxImages,
        );
      return executeVisualCorrectionLoop(
        initial,
        {
          reviewedDesignPackage: review.reviewedDesignPackage!,
          imageAssetSession: assets,
          assetRegistry: registry,
        },
        {
          store: composite,
          imageProvider,
          qaProvider: verification,
          rasterizer,
          budget: coordinator,
          imageModel: mockImage ? "mock-image" : config.imageModel,
          regenLimitUsd: config.imageRegenerationMaxUsd,
          verificationReserveUsd: config.postRenderQaTargetUsd,
          maxRounds: 1,
          maxMb: config.generatedImageMaxMb,
          storageRetries: config.assetStorageMaxRetries,
        },
      );
    },
    persistAuthority: async ({ family, variant, qa }) => {
      if (e2eMock && process.env.NODE_ENV === "production")
        throw new Error("Mock output cannot become production authority.");
      const current = await applicationProjectRepository.getProject(
        family.projectId,
      );
      if (!current || !qa.approvedPackage)
        throw new Error("Durable project or approved package unavailable.");
      return applicationProjectRepository.saveProductionAuthority({
        projectId: family.projectId,
        versionId: `${family.familyId}:${variant.formatId}`,
        operationId: `campaign-authority:${family.familyId}:${variant.inputFingerprint}:${qa.inputFingerprint}`,
        fingerprint: `${family.inputFingerprint}:${variant.inputFingerprint}:${qa.inputFingerprint}`,
        expectedRevision: current.revision,
        postRenderReview: stripBinaryMetadata(qa),
        visualApprovedPackage: qa.approvedPackage,
      });
    },
  };
}
