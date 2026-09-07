export class AIProviderError extends Error {constructor(message: string, public readonly cause?: unknown) { super(message); this.name = 'AIProviderError'; }}
export class AIAuthenticationError extends AIProviderError {override name = 'AIAuthenticationError';}
export class AIRateLimitError extends AIProviderError {override name = 'AIRateLimitError';}
export class AITimeoutError extends AIProviderError {override name = 'AITimeoutError';}
export class AIResponseError extends AIProviderError {override name = 'AIResponseError';}
export class AISchemaError extends AIProviderError {override name = 'AISchemaError'; constructor(message: string, public readonly issues: string[] = [], cause?: unknown) {super(message, cause);}}
export class AIBudgetExceededError extends AIProviderError {override name = 'AIBudgetExceededError';}
export class UnsupportedAIInputError extends AIProviderError {override name = 'UnsupportedAIInputError';}
export class AnalysisPipelineError extends AIProviderError {override name = 'AnalysisPipelineError';}

export const safeErrorMessage = (error: unknown): string => error instanceof AIProviderError ? error.message : 'AI provider operation failed.';
