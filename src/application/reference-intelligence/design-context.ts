import type {DesignDNA} from '../../domain/art-direction/index.js';
import type {ReferenceIntelligenceSession} from './types.js';

export type ConfidenceAuthority = 'strong_constraint' | 'soft_influence' | 'context_only';
export interface ConfidenceControlledValue<T> {value: T; confidence: number; authority: ConfidenceAuthority}
export interface ReferenceDesignContext {
  compositionDNA?: ConfidenceControlledValue<DesignDNA['composition']>;
  hierarchyDNA?: ConfidenceControlledValue<DesignDNA['visualHierarchy']>;
  gridDNA?: ConfidenceControlledValue<DesignDNA['grid']>;
  spacingDNA?: ConfidenceControlledValue<DesignDNA['spacing']>;
  typographyDNA?: ConfidenceControlledValue<DesignDNA['typography']>;
  colorDNA?: ConfidenceControlledValue<DesignDNA['color']>;
  lightingDNA?: ConfidenceControlledValue<DesignDNA['lighting']>;
  materialsDNA?: ConfidenceControlledValue<DesignDNA['materials']>;
  geometryDNA?: ConfidenceControlledValue<DesignDNA['geometry']>;
  depthDNA?: ConfidenceControlledValue<DesignDNA['depth']>;
  gestaltDNA?: ConfidenceControlledValue<DesignDNA['gestalt']>;
  visualPrinciples: Array<{principleId: string; explanation: string; confidence: number}>;
  movementReferences: Array<{movementId: string; confidence: number; matchedPrincipleIds: string[]}>;
  antiAiWarnings: Array<{signal: string; reason: string; correction: string; confidence: number}>;
  negativeSpaceStrategy?: DesignDNA['spacing'];
  confidence: number;
}

const authority = (confidence: number): ConfidenceAuthority => confidence >= 0.75 ? 'strong_constraint' : confidence >= 0.5 ? 'soft_influence' : 'context_only';
export const filterDesignDNAByConfidence = <T>(value: T | undefined, confidence: number): ConfidenceControlledValue<T> | undefined => value === undefined ? undefined : {value, confidence, authority: authority(confidence)};
const average = (values: number[], fallback: number) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : fallback;

export const buildReferenceDesignContext = (session: ReferenceIntelligenceSession): ReferenceDesignContext => {
  if (!session.designDNA || !session.forensics) throw new Error('Reference session has no validated DesignDNA.');
  const dna = session.designDNA;
  const confidence = dna.confidence;
  const typographyConfidence = average(dna.typography?.samples.map(({confidence: value}) => value) ?? [], confidence);
  const movementReferences = (dna.visualMovementInfluence ?? []).map(({movementId, confidence: value, matchedPrincipleIds}) => ({movementId, confidence: value, matchedPrincipleIds}));
  return {
    compositionDNA: filterDesignDNAByConfidence(dna.composition, dna.composition?.balance.confidence ?? confidence),
    hierarchyDNA: filterDesignDNAByConfidence(dna.visualHierarchy, confidence),
    gridDNA: filterDesignDNAByConfidence(dna.grid, dna.grid?.type.confidence ?? confidence),
    spacingDNA: filterDesignDNAByConfidence(dna.spacing, confidence),
    typographyDNA: filterDesignDNAByConfidence(dna.typography, typographyConfidence),
    colorDNA: filterDesignDNAByConfidence(dna.color, confidence),
    lightingDNA: filterDesignDNAByConfidence(dna.lighting, dna.lighting?.confidence ?? confidence),
    materialsDNA: filterDesignDNAByConfidence(dna.materials, average(dna.materials?.map(({confidence: value}) => value) ?? [], confidence)),
    geometryDNA: filterDesignDNAByConfidence(dna.geometry, confidence),
    depthDNA: filterDesignDNAByConfidence(dna.depth, confidence),
    gestaltDNA: filterDesignDNAByConfidence(dna.gestalt, confidence),
    visualPrinciples: session.forensics.inferredPrinciples.map(({principleId, explanation, confidence: value}) => ({principleId, explanation, confidence: value})),
    movementReferences,
    antiAiWarnings: session.forensics.antiAiFindings.filter(({confidence: value}) => value >= 0.5).map(({signal, explanation, confidence: value}) => ({signal, reason: explanation, correction: 'Apply physically coherent, restrained visual treatment.', confidence: value})),
    negativeSpaceStrategy: dna.spacing,
    confidence,
  };
};
