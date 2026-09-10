import { AIBudgetExceededError } from "../providers/errors.js";
export const DEFAULT_SMOKE_MAX_COST_USD = 0.5 as const;
export const ABSOLUTE_SMOKE_MAX_COST_USD = 0.75 as const;
export const resolveSmokeMaxCost = (requested?: number): number => {
  const value = requested ?? DEFAULT_SMOKE_MAX_COST_USD;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > ABSOLUTE_SMOKE_MAX_COST_USD
  )
    throw new AIBudgetExceededError(
      `Smoke max cost must be greater than 0 and no more than ${ABSOLUTE_SMOKE_MAX_COST_USD.toFixed(2)} USD.`,
    );
  return value;
};
