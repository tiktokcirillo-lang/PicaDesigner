export const AI_DEFAULTS = {
  forensicsModel: 'gpt-5.6-terra', criticModel: 'gpt-5.6-sol', requestTimeoutMs: 120_000,
  maxRetries: 1, maxImageMb: 10, maxProjectCostUsd: 0.75, targetProjectCostUsd: 0.50,
  monthlyBudgetUsd: 15, solEscalationEnabled: true,
  budgetReservationTtlSeconds: 600, budgetReservationSafetyFactor: 1.20, allowInMemoryBudget: false,
  artDirectorMaxRevisionRounds:1,seniorCriticTargetUsd:.10,seniorCriticMaxUsd:.18,artDirectionRevisionTargetUsd:.06,artDirectionRevisionMaxUsd:.10,
} as const;

export interface OpenAIConfig {
  apiKey: string; forensicsModel: string; criticModel: string; requestTimeoutMs: number; maxRetries: number;
  maxImageMb: number; maxProjectCostUsd: number; targetProjectCostUsd: number; monthlyBudgetUsd: number;
  solEscalationEnabled: boolean; budgetReservationTtlSeconds:number; budgetReservationSafetyFactor:number; allowInMemoryBudget:boolean;
  artDirectorMaxRevisionRounds:number;seniorCriticTargetUsd:number;seniorCriticMaxUsd:number;artDirectionRevisionTargetUsd:number;artDirectionRevisionMaxUsd:number;
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
  budgetReservationTtlSeconds: positiveNumber(env.AI_BUDGET_RESERVATION_TTL_SECONDS, AI_DEFAULTS.budgetReservationTtlSeconds),
  budgetReservationSafetyFactor: positiveNumber(env.AI_BUDGET_RESERVATION_SAFETY_FACTOR, AI_DEFAULTS.budgetReservationSafetyFactor),
  allowInMemoryBudget: (env.AI_ALLOW_INMEMORY_BUDGET ?? 'false').toLowerCase() === 'true',
  artDirectorMaxRevisionRounds:nonNegativeInteger(env.AI_ART_DIRECTOR_MAX_REVISION_ROUNDS,AI_DEFAULTS.artDirectorMaxRevisionRounds),seniorCriticTargetUsd:positiveNumber(env.AI_SENIOR_CRITIC_TARGET_USD,AI_DEFAULTS.seniorCriticTargetUsd),seniorCriticMaxUsd:positiveNumber(env.AI_SENIOR_CRITIC_MAX_USD,AI_DEFAULTS.seniorCriticMaxUsd),artDirectionRevisionTargetUsd:positiveNumber(env.AI_ART_DIRECTION_REVISION_TARGET_USD,AI_DEFAULTS.artDirectionRevisionTargetUsd),artDirectionRevisionMaxUsd:positiveNumber(env.AI_ART_DIRECTION_REVISION_MAX_USD,AI_DEFAULTS.artDirectionRevisionMaxUsd),
});
