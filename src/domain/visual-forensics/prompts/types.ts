import type {AnalysisDepth, AnalyticalPassId} from '../types.js';

export interface ForensicsPromptModule {
  id: string;
  pass: AnalyticalPassId;
  objective: string;
  instructions: readonly string[];
  prohibited: readonly string[];
  expectedOutputs: readonly string[];
}

export interface PromptBuildContext {analysisDepth: AnalysisDepth; language: string; availableRegionIds?: string[]; availableEvidenceIds?: string[]}

export const buildPromptModule = (module: ForensicsPromptModule, context: PromptBuildContext): string => [
  `Module: ${module.id}`,
  `Pass: ${module.pass}`,
  `Analysis depth: ${context.analysisDepth}`,
  `Output language: ${context.language}`,
  `Objective: ${module.objective}`,
  `Instructions:\n${module.instructions.map((item) => `- ${item}`).join('\n')}`,
  `Prohibited:\n${module.prohibited.map((item) => `- ${item}`).join('\n')}`,
  `Expected outputs:\n${module.expectedOutputs.map((item) => `- ${item}`).join('\n')}`,
  context.availableRegionIds?.length ? `Known region IDs: ${context.availableRegionIds.join(', ')}` : '',
  context.availableEvidenceIds?.length ? `Known evidence IDs: ${context.availableEvidenceIds.join(', ')}` : '',
].filter(Boolean).join('\n\n');
