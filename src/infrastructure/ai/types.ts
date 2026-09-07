import type {AnalysisDepth, AnalyticalPassId, VisualInput} from '../../domain/visual-forensics';

export type AIProviderId = 'openai' | 'gemini' | 'mock';
export type AIModelRole = 'forensics' | 'critic';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AIUsage {inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens?: number}
export interface AIStructuredRequest {
  projectId: string;
  pass: AnalyticalPassId | 'sol_critic' | 'repair';
  model: string;
  instructions: string;
  inputText: string;
  image?: VisualInput;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  repairAttempt?: boolean;
}
export interface AIStructuredResponse<T> {requestId: string; model: string; data: T; usage: AIUsage; durationMs: number}
export interface AIProvider {readonly id: AIProviderId; generateStructured<T>(request: AIStructuredRequest): Promise<AIStructuredResponse<T>>}

export interface AIModelCall {
  requestId: string;
  pass: AIStructuredRequest['pass'];
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  costUsd: number;
  durationMs: number;
  repairAttempt: boolean;
}
export interface ProjectCostLedger {projectId: string; startedAt: string; modelCalls: AIModelCall[]; inputTokens: number; cachedInputTokens: number; outputTokens: number; totalCostUsd: number}
export type BudgetStatus = 'healthy' | 'approaching_limit' | 'at_risk' | 'blocked';
export interface AIProjectBudget {limitUsd: number; targetUsd: number; spentUsd: number; estimatedRemainingUsd: number; status: BudgetStatus}
export interface AIMonthlyBudget {month: string; limitUsd: number; spentUsd: number; remainingUsd: number; projectCount: number}
export type EscalationStatus = 'not_needed' | 'executed' | 'disabled' | 'budget_blocked';
export interface AIUsageResult extends AIUsage {totalCostUsd: number; targetCostUsd: number; limitCostUsd: number; modelsUsed: string[]; calls: AIModelCall[]; escalationStatus: EscalationStatus; escalationReason?: string}

export interface AIAnalysisTelemetry {
  requestId: string; projectId: string; provider: AIProviderId; modelsUsed: string[]; analysisDepth: AnalysisDepth;
  passesExecuted: string[]; totalDurationMs: number; providerCalls: number; repairAttempts: number;
  escalatedToSol: boolean; escalationReason?: string; totalInputTokens: number; totalCachedInputTokens: number;
  totalOutputTokens: number; totalCostUsd: number; budgetStatus: BudgetStatus; success: boolean;
}
