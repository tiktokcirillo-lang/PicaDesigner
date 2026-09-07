import type {ProfessionalMetric, ProfessionalMetricId, ProfessionalMetrics, VisualEvidence} from './types.js';

export interface MetricDefinition {
  id: ProfessionalMetricId;
  description: string;
  zeroAnchor: string;
  oneAnchor: string;
}

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {id: 'negativeSpaceRatio', description: 'Estimated share of canvas functioning as negative space.', zeroAnchor: 'No meaningful negative space', oneAnchor: 'Nearly all canvas is negative space'},
  {id: 'visualDensity', description: 'Perceived concentration of visual information.', zeroAnchor: 'Extremely sparse', oneAnchor: 'Extremely dense'},
  {id: 'symmetryScore', description: 'Degree of reflected or radial visual equivalence.', zeroAnchor: 'Strongly asymmetric', oneAnchor: 'Perfectly symmetric'},
  {id: 'compositionTension', description: 'Perceived instability, edge pressure, or directional opposition.', zeroAnchor: 'Static and resolved', oneAnchor: 'Extremely tense'},
  {id: 'hierarchyClarity', description: 'Clarity of attention and reading order.', zeroAnchor: 'No discernible order', oneAnchor: 'Unambiguous order'},
  {id: 'typographicContrast', description: 'Strength of differentiation among typographic roles.', zeroAnchor: 'Uniform typography', oneAnchor: 'Maximum role contrast'},
  {id: 'colorContrastStrength', description: 'Perceived contrast produced by luminance, hue, and saturation.', zeroAnchor: 'Minimal contrast', oneAnchor: 'Maximum contrast'},
  {id: 'depthStrength', description: 'Strength of spatial separation and layering.', zeroAnchor: 'Completely flat', oneAnchor: 'Strongly dimensional'},
  {id: 'brandDistinctiveness', description: 'Specificity and recognizability of the visual language.', zeroAnchor: 'Generic', oneAnchor: 'Highly distinctive'},
  {id: 'visualSophistication', description: 'Degree of nuanced control across relationships and craft.', zeroAnchor: 'Unresolved', oneAnchor: 'Highly resolved'},
  {id: 'aiArtifactRisk', description: 'Risk that visual signals feel synthetic, generic, or physically inconsistent.', zeroAnchor: 'No evident risk', oneAnchor: 'Severe evident risk'},
];

export const createProfessionalMetric = (
  value: number,
  confidence: number,
  evidence?: VisualEvidence[],
): ProfessionalMetric => ({value, confidence, ...(evidence ? {evidence} : {})});

export const createEmptyProfessionalMetrics = (): ProfessionalMetrics =>
  Object.fromEntries(METRIC_DEFINITIONS.map(({id}) => [id, createProfessionalMetric(0, 0)])) as ProfessionalMetrics;
