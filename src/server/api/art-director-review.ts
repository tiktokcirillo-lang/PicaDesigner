import { Router } from "express";
import { createLedger } from "../../infrastructure/ai/budget/budget-tracker.js";
import { BudgetedAIExecutor } from "../../infrastructure/ai/budget/executor.js";
import { applicationBudgetStore } from "../../infrastructure/ai/budget/runtime-store.js";
import { loadOpenAIConfig } from "../../infrastructure/ai/providers/openai/config.js";
import { createStructuredAIProvider } from "../../infrastructure/ai/providers/factory.js";
import {
  AIIdempotencyConflictError,
  safeErrorMessage,
} from "../../infrastructure/ai/providers/errors.js";
import {
  createArtDirectorReview,
  OpenAISeniorArtDirectorCritic,
} from "../../application/art-director-review/index.js";
import type { ArtDirectorReviewRequest } from "../../domain/art-director-review/index.js";
export const createArtDirectorReviewRouter = () => {
  const router = Router();
  router.post("/review", async (req, res) => {
    try {
      const body = req.body as ArtDirectorReviewRequest;
      if (
        !body.projectId ||
        !body.creativeDirection ||
        !body.layoutIntelligence
      )
        return res.status(400).json({
          error:
            "projectId, creativeDirection and layoutIntelligence are required",
        });
      const config = loadOpenAIConfig(),
        ledger =
          (await applicationBudgetStore.getProject(body.projectId)) ??
          createLedger(body.projectId),
        executor = new BudgetedAIExecutor(
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
            stageLimitUsd: config.seniorCriticMaxUsd,
          },
        ),
        critic = new OpenAISeniorArtDirectorCritic(
          executor,
          config.criticModel,
        );
      return res.json(await createArtDirectorReview(body, critic));
    } catch (e) {
      return res
        .status(e instanceof AIIdempotencyConflictError ? 409 : 422)
        .json({ error: safeErrorMessage(e) });
    }
  });
  return router;
};
