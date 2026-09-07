import type {AnalysisDepth, AnalyticalPassId, VisualInput} from '../../domain/visual-forensics/index.js';

export type AIProviderId = 'openai' | 'mock';
export type AIModelRole = 'forensics' | 'critic';
export type AIApplicationTask = 'refine_copy' | 'generate_design_spec' | 'creative_direction';
export type AIStage = 'visual_forensics' | 'brand_intelligence' | 'creative_direction' | 'design_spec' | 'senior_critic' | 'image_generation' | 'layout_intelligence' | 'other';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AIUsage {inputTokens: number; cachedInputTokens: number; cacheWriteTokens: number; outputTokens: number; reasoningTokens?: number}
export interface AIStructuredRequest {
  projectId: string;
  pass: AnalyticalPassId | 'sol_critic' | 'repair' | AIApplicationTask;
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
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  costUsd: number;
  durationMs: number;
  maxOutputTokens: number;
  outputTokenUtilization: number;
  repairAttempt: boolean;
  stage?: AIStage;
  operationId?: string;
  budgetOverrun?: boolean;
  occurredAt?: string;
}
export interface ProjectCostLedger {projectId: string; startedAt: string; modelCalls: AIModelCall[]; inputTokens: number; cachedInputTokens: number; cacheWriteTokens: number; outputTokens: number; repairAttempts: number; totalCostUsd: number}
export type BudgetStatus = 'healthy' | 'approaching_limit' | 'at_risk' | 'blocked';
export type BudgetReservationStatus = 'reserved' | 'committed' | 'released' | 'expired' | 'unknown_provider_outcome';
export interface BudgetReservation {reservationId:string;operationId?:string;projectId:string;month:string;stage:AIStage;estimatedMicroUsd:number;createdAt:string;expiresAt:string;status:BudgetReservationStatus}
export interface BudgetReservationRequest {projectId:string;month:string;stage:AIStage;operationId?:string;estimatedMicroUsd:number;projectLimitMicroUsd:number;monthlyLimitMicroUsd:number;stageLimitMicroUsd?:number;ttlSeconds:number}
export interface AIProjectBudget {limitUsd: number; targetUsd: number; spentUsd: number; estimatedRemainingUsd: number; status: BudgetStatus}
export interface AIMonthlyBudget {month: string; limitUsd: number; spentUsd: number; remainingUsd: number; projectCount: number}
export interface ProjectAIUsageSnapshot {projectId:string;spentUsd:number;reservedUsd:number;remainingUsd:number;monthlySpentUsd:number;monthlyReservedUsd:number;monthlyRemainingUsd:number;stages:Partial<Record<AIStage,{spentUsd:number;reservedUsd:number}>>;calls:AIModelCall[];status:BudgetStatus}
export type EscalationStatus = 'not_needed' | 'executed' | 'disabled' | 'budget_blocked';
export interface AIUsageResult extends AIUsage {totalCostUsd: number; targetCostUsd: number; limitCostUsd: number; modelsUsed: string[]; calls: AIModelCall[]; escalationStatus: EscalationStatus; escalationReason?: string}

export interface AIAnalysisTelemetry {
  requestId: string; projectId: string; provider: AIProviderId; modelsUsed: string[]; analysisDepth: AnalysisDepth;
  passesExecuted: string[]; totalDurationMs: number; providerCalls: number; repairAttempts: number;
  escalatedToSol: boolean; escalationReason?: string; totalInputTokens: number; totalCachedInputTokens: number; totalCacheWriteTokens: number;
  totalOutputTokens: number; outputTokenUtilization: Array<{pass: AIModelCall['pass']; maxOutputTokens: number; actualOutputTokens: number; utilizationRatio: number}>;
  totalCostUsd: number; budgetStatus: BudgetStatus; success: boolean;
}
