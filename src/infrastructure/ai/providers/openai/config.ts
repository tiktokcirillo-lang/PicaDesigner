export const AI_DEFAULTS = {
  forensicsModel: 'gpt-5.6-terra', criticModel: 'gpt-5.6-sol', requestTimeoutMs: 120_000,
  maxRetries: 1, maxImageMb: 10, maxProjectCostUsd: 0.75, targetProjectCostUsd: 0.50,
  monthlyBudgetUsd: 15, solEscalationEnabled: true,
} as const;

export interface OpenAIConfig {
  apiKey: string; forensicsModel: string; criticModel: string; requestTimeoutMs: number; maxRetries: number;
  maxImageMb: number; maxProjectCostUsd: number; targetProjectCostUsd: number; monthlyBudgetUsd: number;
  solEscalationEnabled: boolean;
}
const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const nonNegativeInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};
export const loadOpenAIConfig = (env: NodeJS.ProcessEnv = process.env): OpenAIConfig => ({
  apiKey: env.OPENAI_API_KEY?.trim() ?? '',
  forensicsModel: env.OPENAI_FORENSICS_MODEL?.trim() || AI_DEFAULTS.forensicsModel,
  criticModel: env.OPENAI_CRITIC_MODEL?.trim() || AI_DEFAULTS.criticModel,
  requestTimeoutMs: positiveNumber(env.AI_REQUEST_TIMEOUT_MS, AI_DEFAULTS.requestTimeoutMs),
  maxRetries: nonNegativeInteger(env.AI_MAX_RETRIES, AI_DEFAULTS.maxRetries),
  maxImageMb: positiveNumber(env.AI_MAX_IMAGE_MB, AI_DEFAULTS.maxImageMb),
  maxProjectCostUsd: positiveNumber(env.AI_MAX_PROJECT_COST_USD, AI_DEFAULTS.maxProjectCostUsd),
  targetProjectCostUsd: positiveNumber(env.AI_TARGET_PROJECT_COST_USD, AI_DEFAULTS.targetProjectCostUsd),
  monthlyBudgetUsd: positiveNumber(env.AI_MONTHLY_BUDGET_USD, AI_DEFAULTS.monthlyBudgetUsd),
  solEscalationEnabled: (env.AI_SOL_ESCALATION_ENABLED ?? 'true').toLowerCase() === 'true',
});
