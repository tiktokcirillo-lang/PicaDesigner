export const PRICING_REGISTRY_VERSION = "2026-09-07" as const;
export interface ModelPricing {
  inputPerMillionUsd: number;
  cachedInputPerMillionUsd: number;
  cacheWritePerMillionUsd: number;
  outputPerMillionUsd: number;
  effectiveDate: string;
  sourceDescription: string;
}
export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  "gpt-5.6-terra": {
    inputPerMillionUsd: 2,
    cachedInputPerMillionUsd: 0.2,
    cacheWritePerMillionUsd: 2.5,
    outputPerMillionUsd: 12,
    effectiveDate: "2026-09-07",
    sourceDescription:
      "OpenAI model docs: cache writes are 1.25x uncached input; verify before production pricing changes.",
  },
  "gpt-5.6-sol": {
    inputPerMillionUsd: 4,
    cachedInputPerMillionUsd: 0.4,
    cacheWritePerMillionUsd: 5,
    outputPerMillionUsd: 20,
    effectiveDate: "2026-09-07",
    sourceDescription:
      "OpenAI model docs: cache writes are 1.25x uncached input; verify before production pricing changes.",
  },
};
export class UnknownModelPricingError extends Error {
  constructor(model: string) {
    super(`No pricing registered for model: ${model}`);
    this.name = "UnknownModelPricingError";
  }
}
export const getModelPricing = (model: string): ModelPricing => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) throw new UnknownModelPricingError(model);
  return pricing;
};
