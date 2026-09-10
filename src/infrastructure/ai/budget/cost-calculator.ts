import type { AIUsage } from "../types.js";
import { getModelPricing } from "./pricing.js";

export interface EstimatedCallUsage {
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
}
export const calculateActualCost = (model: string, usage: AIUsage): number => {
  const pricing = getModelPricing(model);
  const cached = Math.max(
    0,
    Math.min(usage.inputTokens, usage.cachedInputTokens),
  );
  const cacheWrite = Math.max(
    0,
    Math.min(usage.inputTokens - cached, usage.cacheWriteTokens),
  );
  const uncached = Math.max(0, usage.inputTokens - cached - cacheWrite);
  return (
    (uncached * pricing.inputPerMillionUsd +
      cached * pricing.cachedInputPerMillionUsd +
      cacheWrite * pricing.cacheWritePerMillionUsd +
      usage.outputTokens * pricing.outputPerMillionUsd) /
    1_000_000
  );
};
export const estimateCallCost = (
  model: string,
  usage: EstimatedCallUsage,
): number =>
  calculateActualCost(model, {
    ...usage,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  });
export const formatCostUsd = (cost: number): string => `$${cost.toFixed(4)}`;
