import { AIBudgetExceededError } from "../providers/errors.js";
import type {
  AIProjectBudget,
  BudgetStatus,
  ProjectCostLedger,
} from "../types.js";

export const getBudgetStatus = (
  spentUsd: number,
  limitUsd: number,
): BudgetStatus => {
  const ratio = limitUsd > 0 ? spentUsd / limitUsd : 1;
  if (ratio >= 1) return "blocked";
  if (ratio >= 0.8) return "at_risk";
  if (ratio >= 0.6) return "approaching_limit";
  return "healthy";
};
export const createProjectBudget = (
  limitUsd = 0.75,
  targetUsd = 0.5,
  spentUsd = 0,
): AIProjectBudget => ({
  limitUsd,
  targetUsd,
  spentUsd,
  estimatedRemainingUsd: Math.max(0, limitUsd - spentUsd),
  status: getBudgetStatus(spentUsd, limitUsd),
});
export const assertCallWithinBudget = (
  ledger: ProjectCostLedger,
  estimatedCostUsd: number,
  limitUsd: number,
): void => {
  if (ledger.totalCostUsd + estimatedCostUsd > limitUsd)
    throw new AIBudgetExceededError(
      `AI call blocked: estimated project cost would exceed the ${limitUsd.toFixed(2)} USD hard limit.`,
    );
};
