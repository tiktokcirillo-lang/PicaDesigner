import type {AnalyticalPassId} from '../../../domain/visual-forensics/index.js';
import type {OpenAIConfig} from '../providers/openai/config.js';
import type {ReasoningEffort} from '../types.js';

export const REASONING_POLICY: Readonly<Record<AnalyticalPassId | 'sol_critic' | 'repair', ReasoningEffort>> = {
  raw_observation: 'low', spatial_relationships: 'medium', domain_analysis: 'medium', principle_inference: 'medium', consistency_check: 'medium', design_dna_mapping: 'none', sol_critic: 'high', repair: 'medium',
};
export const OUTPUT_TOKEN_LIMITS: Readonly<Record<AnalyticalPassId | 'sol_critic' | 'repair', number>> = {
  raw_observation: 6000, spatial_relationships: 5000, domain_analysis: 9000, principle_inference: 4000, consistency_check: 4000, design_dna_mapping: 0, sol_critic: 4000, repair: 6000,
};
export class ModelRouter {constructor(private readonly config: OpenAIConfig) {} forPass(pass: AnalyticalPassId | 'repair') {return pass === 'design_dna_mapping' ? null : this.config.forensicsModel;} critic() {return this.config.criticModel;}}
