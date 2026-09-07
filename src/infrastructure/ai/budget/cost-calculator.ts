import type {AIUsage} from '../types';
import {getModelPricing} from './pricing';

export interface EstimatedCallUsage {inputTokens: number; cachedInputTokens?: number; outputTokens: number}
export const calculateActualCost = (model: string, usage: AIUsage): number => {
  const pricing = getModelPricing(model);
  const cached = Math.max(0, Math.min(usage.inputTokens, usage.cachedInputTokens));
  const uncached = Math.max(0, usage.inputTokens - cached);
  return (uncached * pricing.inputPerMillionUsd + cached * pricing.cachedInputPerMillionUsd + usage.outputTokens * pricing.outputPerMillionUsd) / 1_000_000;
};
export const estimateCallCost = (model: string, usage: EstimatedCallUsage): number => calculateActualCost(model, {...usage, cachedInputTokens: usage.cachedInputTokens ?? 0});
export const formatCostUsd = (cost: number): string => `$${cost.toFixed(4)}`;
