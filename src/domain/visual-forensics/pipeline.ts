import type {AnalysisDepth, AnalyticalPass} from './types';

export const ANALYSIS_DEPTH_CAPABILITIES: Readonly<Record<AnalysisDepth, string[]>> = {
  quick: ['major regions', 'high-level composition', 'primary focus'],
  standard: ['quick capabilities', 'domain analysis', 'semantic firewall'],
  deep: ['standard capabilities', 'relationships', 'measurements', 'principle evidence'],
  forensic: ['deep capabilities', 'maximum decomposition', 'contradictions', 'evidence quality audit'],
};

export const ANALYTICAL_PASSES: readonly AnalyticalPass[] = [
  {id: 'raw_observation', order: 1, requires: [], produces: ['observations', 'regions', 'semanticContent'], minimumDepth: 'quick'},
  {id: 'spatial_relationships', order: 2, requires: ['raw_observation'], produces: ['relationships', 'measurements'], minimumDepth: 'deep'},
  {id: 'domain_analysis', order: 3, requires: ['raw_observation'], produces: ['composition', 'hierarchy', 'spacing', 'typography', 'color', 'lighting', 'depth', 'materials'], minimumDepth: 'standard'},
  {id: 'principle_inference', order: 4, requires: ['raw_observation', 'domain_analysis'], produces: ['inferredPrinciples', 'antiAiFindings'], minimumDepth: 'deep'},
  {id: 'consistency_check', order: 5, requires: ['domain_analysis', 'principle_inference'], produces: ['uncertainties', 'contradictions', 'evidenceQuality'], minimumDepth: 'forensic'},
  {id: 'design_dna_mapping', order: 6, requires: ['consistency_check'], produces: ['DesignDNA'], minimumDepth: 'forensic'},
];
