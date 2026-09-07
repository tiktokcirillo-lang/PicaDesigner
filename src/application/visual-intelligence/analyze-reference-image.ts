import {mapForensicsToDesignDNA, type VisualForensicsInput} from '../../domain/visual-forensics';
import {AIBudgetExceededError} from '../../infrastructure/ai/providers/errors';
import {OpenAIVisualForensicsExtractor} from '../../infrastructure/ai/providers/openai/extractor';
import type {OpenAIConfig} from '../../infrastructure/ai/providers/openai/config';
import {BudgetedAIExecutor} from '../../infrastructure/ai/budget/executor';
import {estimateCallCost} from '../../infrastructure/ai/budget/cost-calculator';
import {createLedger, type BudgetStore} from '../../infrastructure/ai/budget/budget-tracker';
import {createProjectBudget} from '../../infrastructure/ai/budget/budget-policy';
import {ModelRouter, OUTPUT_TOKEN_LIMITS, REASONING_POLICY} from '../../infrastructure/ai/router/model-router';
import type {AIProvider, AIUsageResult, EscalationStatus} from '../../infrastructure/ai/types';
import type {DesignDNA} from '../../domain/art-direction';
import type {VisualForensicsReport} from '../../domain/visual-forensics';
import {evaluateForensicsQuality, shouldEscalateToSol, type QualityProfile, type SolCriticResult} from './quality';

const CRITIC_SCHEMA = {type: 'object', additionalProperties: false, properties: {criticScore: {type: 'number', minimum: 0, maximum: 100}, dimensions: {type: 'object', additionalProperties: false, properties: Object.fromEntries(['evidenceIntegrity', 'compositionReasoning', 'hierarchyReasoning', 'typographicReasoning', 'colorReasoning', 'physicalPlausibility', 'semanticSeparation', 'antiAiDetection', 'confidenceCalibration'].map((key) => [key, {type: 'number', minimum: 0, maximum: 100}])), required: ['evidenceIntegrity', 'compositionReasoning', 'hierarchyReasoning', 'typographicReasoning', 'colorReasoning', 'physicalPlausibility', 'semanticSeparation', 'antiAiDetection', 'confidenceCalibration']}, issues: {type: 'array', items: {type: 'string'}}, corrections: {type: 'array', items: {type: 'string'}}, requiresRevision: {type: 'boolean'}, confidence: {type: 'number', minimum: 0, maximum: 1}}, required: ['criticScore', 'dimensions', 'issues', 'corrections', 'requiresRevision', 'confidence']} as const;
const SOL_ESTIMATE = {inputTokens: 12000, cachedInputTokens: 2500, outputTokens: 2500};

export interface AnalyzeReferenceImageRequest extends VisualForensicsInput {projectId: string}
export interface VisualIntelligenceResult {forensics: VisualForensicsReport; designDNA: DesignDNA; quality: QualityProfile & {critic?: SolCriticResult}; aiUsage: AIUsageResult}
export interface AnalyzeDependencies {provider: AIProvider; budgetStore: BudgetStore; config: OpenAIConfig}

const validCritic = (value: unknown): value is SolCriticResult => Boolean(value && typeof value === 'object' && typeof (value as SolCriticResult).criticScore === 'number' && (value as SolCriticResult).criticScore >= 0 && (value as SolCriticResult).criticScore <= 100 && typeof (value as SolCriticResult).confidence === 'number');

export const analyzeReferenceImage = async (request: AnalyzeReferenceImageRequest, dependencies: AnalyzeDependencies): Promise<VisualIntelligenceResult> => {
  const {provider, budgetStore, config} = dependencies;
  const month = new Date().toISOString().slice(0, 7);
  const monthly = await budgetStore.getMonth(month, config.monthlyBudgetUsd);
  if (monthly.spentUsd >= monthly.limitUsd) throw new AIBudgetExceededError('Monthly AI budget is exhausted.');
  const initialLedger = await budgetStore.getProject(request.projectId) ?? createLedger(request.projectId);
  const executor = new BudgetedAIExecutor(provider, budgetStore, config.maxProjectCostUsd, initialLedger, monthly.remainingUsd);
  const extractor = new OpenAIVisualForensicsExtractor(executor, new ModelRouter(config), request.projectId, initialLedger);
  const forensics = await extractor.analyze(request);
  const designDNA = mapForensicsToDesignDNA(forensics);
  const quality = evaluateForensicsQuality(forensics, designDNA);
  const decision = shouldEscalateToSol(forensics, quality);
  let escalationStatus: EscalationStatus = 'not_needed';
  let critic: SolCriticResult | undefined;
  if (decision.escalate) {
    if (!config.solEscalationEnabled) escalationStatus = 'disabled';
    else {
      const ledger = executor.getLedger();
      const estimatedCost = estimateCallCost(config.criticModel, SOL_ESTIMATE);
      if (ledger.totalCostUsd + estimatedCost > config.maxProjectCostUsd) escalationStatus = 'budget_blocked';
      else {
        const compactPacket = {designDNA, evidenceQuality: forensics.evidenceQuality, uncertainties: forensics.uncertainties, contradictions: forensics.contradictions, majorObservations: forensics.observations.slice(0, 20), majorInferredPrinciples: forensics.inferredPrinciples.slice(0, 12)};
        const response = await executor.execute<SolCriticResult>({projectId: request.projectId, pass: 'sol_critic', model: config.criticModel, instructions: 'Act only as a senior art director auditor. Check evidence support, semantic leakage, hierarchy coherence, structural typography, physical plausibility, fake precision, and whether DesignDNA captures structural identity. Do not generate creative direction.', inputText: JSON.stringify(compactPacket), schemaName: 'senior_art_director_critic', jsonSchema: CRITIC_SCHEMA, reasoningEffort: REASONING_POLICY.sol_critic, maxOutputTokens: OUTPUT_TOKEN_LIMITS.sol_critic}, SOL_ESTIMATE);
        if (validCritic(response.data)) {critic = response.data; escalationStatus = 'executed';}
      }
    }
  }
  const ledger = executor.getLedger();
  const budget = createProjectBudget(config.maxProjectCostUsd, config.targetProjectCostUsd, ledger.totalCostUsd);
  return {forensics, designDNA, quality: {...quality, ...(critic ? {critic} : {})}, aiUsage: {inputTokens: ledger.inputTokens, cachedInputTokens: ledger.cachedInputTokens, cacheWriteTokens: ledger.cacheWriteTokens, outputTokens: ledger.outputTokens, totalCostUsd: ledger.totalCostUsd, targetCostUsd: config.targetProjectCostUsd, limitCostUsd: config.maxProjectCostUsd, modelsUsed: [...new Set(ledger.modelCalls.map(({model}) => model))], calls: ledger.modelCalls, escalationStatus, escalationReason: decision.reasons.join(' ') || undefined, ...(budget.status === 'blocked' ? {escalationStatus: 'budget_blocked'} : {})}};
};
