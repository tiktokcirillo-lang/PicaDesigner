import {BudgetedAIExecutor} from '../../infrastructure/ai/budget/executor.js';
import {createLedger, type BudgetStore} from '../../infrastructure/ai/budget/budget-tracker.js';
import type {OpenAIConfig} from '../../infrastructure/ai/providers/openai/config.js';
import type {AIProvider, AIUsageResult} from '../../infrastructure/ai/types.js';
import type {VisualInput} from '../../domain/visual-forensics/index.js';
import {DesignSpecPromptBuilder} from '../design-spec/prompt-builder.js';
import type {DesignSpecificationResult, GenerateDesignSpecRequest} from '../design-spec/types.js';
import {isReferenceQualityUsable, validateReferenceSession} from '../reference-intelligence/create-reference-intelligence.js';

const TEXT_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {text: {type: 'string'}},
  required: ['text'],
} as const;

interface Dependencies {provider: AIProvider; budgetStore: BudgetStore; config: OpenAIConfig}
interface TextTaskResult {text: string; aiUsage: AIUsageResult}

const resultFromLedger = (ledger: ReturnType<typeof createLedger>, config: OpenAIConfig): AIUsageResult => ({
  inputTokens: ledger.inputTokens,
  cachedInputTokens: ledger.cachedInputTokens,
  cacheWriteTokens: ledger.cacheWriteTokens,
  outputTokens: ledger.outputTokens,
  totalCostUsd: ledger.totalCostUsd,
  targetCostUsd: config.targetProjectCostUsd,
  limitCostUsd: config.maxProjectCostUsd,
  modelsUsed: [...new Set(ledger.modelCalls.map(({model}) => model))],
  calls: ledger.modelCalls,
  escalationStatus: 'not_needed',
});

const executeTextTask = async (input: {projectId: string; task: 'refine_copy' | 'generate_design_spec'; instructions: string; prompt: string; image?: VisualInput; maxOutputTokens: number}, dependencies: Dependencies): Promise<TextTaskResult> => {
  const ledger = createLedger(input.projectId);
  const executor = new BudgetedAIExecutor(dependencies.provider, dependencies.budgetStore, dependencies.config.maxProjectCostUsd, ledger);
  const response = await executor.execute<{text: string}>({
    projectId: input.projectId,
    pass: input.task,
    model: dependencies.config.forensicsModel,
    instructions: input.instructions,
    inputText: input.prompt,
    image: input.image,
    schemaName: `${input.task}_result`,
    jsonSchema: TEXT_RESULT_SCHEMA,
    reasoningEffort: input.task === 'refine_copy' ? 'low' : 'medium',
    maxOutputTokens: input.maxOutputTokens,
  }, input.task === 'refine_copy'
    ? {inputTokens: 3_000, outputTokens: 1_500}
    : {inputTokens: input.image ? 15_000 : 8_000, outputTokens: 9_000});
  const finalLedger = executor.getLedger();
  return {text: response.data.text.trim(), aiUsage: resultFromLedger(finalLedger, dependencies.config)};
};

export const refineCopy = (input: {projectId: string; text: string; tone: string}, dependencies: Dependencies): Promise<TextTaskResult> => executeTextTask({
  projectId: input.projectId,
  task: 'refine_copy',
  instructions: 'You are a senior Portuguese-language copy editor for presentations and interfaces. Improve clarity, impact, grammar, flow, and visual readability while preserving meaning. Return only the refined copy in the structured text field.',
  prompt: `Tone: ${input.tone}\n\nOriginal copy:\n${input.text}`,
  maxOutputTokens: 1_500,
}, dependencies);

export const generateDesignSpec = async (input: GenerateDesignSpecRequest, dependencies: Dependencies): Promise<DesignSpecificationResult> => {
  if (input.referenceIntelligence) {
    if (!validateReferenceSession(input.referenceIntelligence, input.projectId)) throw new Error('Invalid or incompatible reference intelligence session.');
    if (!isReferenceQualityUsable(input.referenceIntelligence)) throw new Error('Reference intelligence quality is below the minimum threshold.');
  }
  const built = input.legacyPrompt
    ? {instructions: 'Produce a professional Portuguese visual design specification. Return only the completed specification in the structured text field.', input: input.legacyPrompt, decisions: []}
    : new DesignSpecPromptBuilder().build(input);
  const result = await executeTextTask({projectId: input.projectId, task: 'generate_design_spec', instructions: built.instructions, prompt: built.input, maxOutputTokens: 9_000}, dependencies);
  return {
    content: result.text,
    projectId: input.projectId,
    referenceSessionId: input.referenceIntelligence?.sessionId,
    qualityMetadata: {referenceQualityScore: input.referenceIntelligence?.quality?.score, referenceConfidence: input.referenceIntelligence?.forensics?.overallConfidence, decisionProvenance: built.decisions},
    aiUsage: result.aiUsage,
  };
};
