import type {NormalizedValue} from '../art-direction/index.js';

export interface WeightedConfidence {confidence: NormalizedValue; weight?: number}

const clamp = (value: number): NormalizedValue => Math.max(0, Math.min(1, value));

/**
 * Conservative propagation: weighted mean capped by the strongest dependency,
 * then multiplied by an evidence sufficiency factor. Missing evidence yields 0.
 */
export const propagateConfidence = (
  dependencies: readonly WeightedConfidence[],
  evidenceSufficiency: NormalizedValue = 1,
): NormalizedValue => {
  if (dependencies.length === 0) return 0;
  const weighted = dependencies.map(({confidence, weight = 1}) => ({confidence: clamp(confidence), weight: Math.max(0, weight)}));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  const mean = weighted.reduce((sum, item) => sum + item.confidence * item.weight, 0) / totalWeight;
  const strongestDependency = Math.max(...weighted.map(({confidence}) => confidence));
  return clamp(Math.min(mean, strongestDependency) * clamp(evidenceSufficiency));
};

export const conservativeMinimumConfidence = (values: readonly number[]): NormalizedValue =>
  values.length === 0 ? 0 : clamp(Math.min(...values));
