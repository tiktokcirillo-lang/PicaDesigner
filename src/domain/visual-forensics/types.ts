import type {
  Alignment,
  AntiAISignalId,
  BoundingBox,
  DesignDomain,
  Direction,
  NormalizedEdgeTension,
  NormalizedValue,
  SemanticExclusions,
  Temperature,
  VisualEvidence,
} from '../art-direction';

export const VISUAL_FORENSICS_SCHEMA_VERSION = '1.0.0' as const;
export type VisualForensicsSchemaVersion = typeof VISUAL_FORENSICS_SCHEMA_VERSION;
export type AnalysisDepth = 'quick' | 'standard' | 'deep' | 'forensic';
export type Point = {x: NormalizedValue; y: NormalizedValue};

export interface ForensicsMetadata {
  id?: string;
  sourceId?: string;
  createdAt?: string;
  extractor?: {name: string; version?: string};
  analysisDepth: AnalysisDepth;
  language?: string;
}

export interface CanvasAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
  estimatedSafeArea?: BoundingBox;
  visualCenter: Point;
  opticalCenter: {point: Point; confidence: NormalizedValue; evidenceIds: string[]};
}

export type VisualRegionType = 'background' | 'foreground' | 'midground' | 'text' | 'graphic' | 'photo' | 'object' | 'shape' | 'logo' | 'negative_space' | 'texture' | 'unknown';

export interface VisualRegion {
  id: string;
  type: VisualRegionType;
  boundingBox: BoundingBox;
  areaRatio: NormalizedValue;
  centroid: Point;
  visualWeight: NormalizedValue;
  salience: NormalizedValue;
  edgeProximity: NormalizedEdgeTension;
  contrastAgainstEnvironment: NormalizedValue;
  confidence: NormalizedValue;
  evidenceIds?: string[];
}

export type ObservationDomain = DesignDomain | 'canvas' | 'relationships' | 'semantic' | 'anti_ai';
export type MeasurementKind = 'normalizedDistance' | 'angle' | 'areaRatio' | 'relativeScale' | 'luminanceDifference' | 'colorDistance' | 'alignmentDeviation' | 'spacingRatio' | 'edgeDistance' | 'overlapRatio';

export interface ForensicMeasurement {
  kind: MeasurementKind;
  value: number;
  unit: 'normalized' | 'degrees' | 'ratio' | 'delta_e' | 'relative';
  confidence: NormalizedValue;
  method?: 'estimated' | 'calculated' | 'provider_supplied';
}

export interface RawVisualObservation {
  id: string;
  domain: ObservationDomain;
  observation: string;
  region?: BoundingBox;
  confidence: NormalizedValue;
  inferenceLevel: 'observed';
  measurement?: ForensicMeasurement;
  relatedRegionIds?: string[];
}

export type VisualRelationshipType = 'alignment' | 'proximity' | 'overlap' | 'containment' | 'repetition' | 'similarity' | 'contrast' | 'continuation' | 'direction' | 'scale_difference' | 'spacing' | 'grouping' | 'occlusion';

export interface VisualRelationship {
  id: string;
  sourceRegionId: string;
  targetRegionId: string;
  relationship: VisualRelationshipType;
  strength: NormalizedValue;
  evidenceIds: string[];
  evidence: VisualEvidence[];
  confidence: NormalizedValue;
  measurement?: ForensicMeasurement;
}

export type VisualWeightMap = Record<'topLeft' | 'topCenter' | 'topRight' | 'middleLeft' | 'center' | 'middleRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight', NormalizedValue>;

export interface CompositionForensics {
  symmetryScore: NormalizedValue;
  asymmetryStrength: NormalizedValue;
  balance: 'symmetric' | 'asymmetric' | 'radial' | 'dynamic' | 'ambiguous';
  balanceConfidence: NormalizedValue;
  visualCenterOfGravity: Point;
  visualMassDistribution: VisualWeightMap;
  directionalFlow: Direction[];
  edgeTension: NormalizedEdgeTension;
  framing: string[];
  cropping: 'none' | 'conservative' | 'intentional' | 'aggressive' | 'uncertain';
  overlapStrength: NormalizedValue;
  layeringStrength: NormalizedValue;
  focalRegionIds: string[];
  evidenceIds: string[];
}

export type HierarchyFactorType = 'scale' | 'contrast' | 'isolation' | 'position' | 'color' | 'sharpness' | 'depth' | 'semantic_salience';
export interface HierarchyFactor {factor: HierarchyFactorType; contribution: NormalizedValue; confidence: NormalizedValue; evidenceIds: string[]}
export interface HierarchyFocus {regionId: string; level: 'primary' | 'secondary' | 'tertiary'; factors: HierarchyFactor[]; score: NormalizedValue; confidence: NormalizedValue; explanation: string}
export type ReadingPattern = 'z_pattern' | 'f_pattern' | 'radial' | 'linear' | 'custom' | 'mixed' | 'uncertain';
export interface ReadingTransition {fromRegionId: string; toRegionId: string; strength: NormalizedValue; evidenceIds: string[]}
export interface ReadingFlow {entryPoint?: string; attentionSequence: string[]; transitions: ReadingTransition[]; exitPoint?: string; readingPattern: ReadingPattern; confidence: NormalizedValue; evidenceIds: string[]}
export interface HierarchyForensics {primaryFocus?: HierarchyFocus; secondaryFocus: HierarchyFocus[]; tertiaryFocus: HierarchyFocus[]; readingFlow: ReadingFlow; clarity: NormalizedValue; evidenceIds: string[]}

export interface NegativeSpaceForensics {
  negativeSpaceRatio: NormalizedValue;
  largestNegativeRegionId?: string;
  distribution: 'central' | 'peripheral' | 'balanced' | 'top_heavy' | 'bottom_heavy' | 'left_heavy' | 'right_heavy' | 'fragmented' | 'uncertain';
  activeRatio: NormalizedValue;
  passiveRatio: NormalizedValue;
  purposePotential: NormalizedValue;
  balanceContribution: NormalizedValue;
  textPlacementPotential: NormalizedValue;
  breathingRoom: NormalizedValue;
  edgePressure: NormalizedEdgeTension;
  confidence: NormalizedValue;
  evidenceIds: string[];
}

export interface SpacingForensics {negativeSpace: NegativeSpaceForensics; alignmentRhythm: NormalizedValue; spacingConsistency: NormalizedValue; density: NormalizedValue; evidenceIds: string[]}

export interface ConfidentFeature<T> {value: T; confidence: NormalizedValue; evidenceIds: string[]}
export interface TypographyRegion {
  regionId: string;
  classification: ConfidentFeature<'serif' | 'sans_serif' | 'slab_serif' | 'display' | 'script' | 'monospace' | 'mixed' | 'unknown'>;
  estimatedWeight: ConfidentFeature<number>;
  estimatedWidth: ConfidentFeature<'condensed' | 'normal' | 'extended' | 'variable' | 'unknown'>;
  caseBehavior: ConfidentFeature<'uppercase' | 'lowercase' | 'title' | 'sentence' | 'mixed' | 'unknown'>;
  trackingCharacter: ConfidentFeature<'tight' | 'normal' | 'wide' | 'mixed' | 'unknown'>;
  leadingCharacter: ConfidentFeature<'tight' | 'normal' | 'open' | 'mixed' | 'unknown'>;
  lineLength: ConfidentFeature<number>;
  numberOfLines: ConfidentFeature<number>;
  alignment: ConfidentFeature<Alignment>;
  textBlockDensity: NormalizedValue;
  scaleRelationship: NormalizedValue;
  headlineBehavior: string[];
  hierarchyRole: ConfidentFeature<'headline' | 'subheadline' | 'body' | 'caption' | 'label' | 'display' | 'unknown'>;
  confidence: NormalizedValue;
}
export interface TypographyForensics {regions: TypographyRegion[]; contrastStrength: NormalizedValue; hierarchyOrder: string[]; evidenceIds: string[]}

export interface ForensicColorSample {id: string; hex?: string; rgb?: [number, number, number]; estimatedCoverage: NormalizedValue; relativeLuminance: NormalizedValue; saturation: NormalizedValue; temperature: Temperature; confidence: NormalizedValue; evidenceIds: string[]}
export interface ColorFunction {sampleId: string; function: 'dominant' | 'supporting' | 'accent' | 'background' | 'foreground' | 'focal_dominance' | 'separation' | 'grouping' | 'unknown'; explanation: string; confidence: NormalizedValue; evidenceIds: string[]}
export interface ColorContrastRelationship {sourceSampleId: string; targetSampleId: string; strength: NormalizedValue; kind: 'luminance' | 'hue' | 'saturation' | 'temperature' | 'mixed'; confidence: NormalizedValue}
export interface ColorForensics {samples: ForensicColorSample[]; functions: ColorFunction[]; contrastRelationships: ColorContrastRelationship[]; backgroundForegroundContrast: NormalizedValue; distribution: Array<{regionId: string; sampleIds: string[]; coverage: NormalizedValue}>; evidenceIds: string[]}

export interface LightingForensics {
  lightDirection?: ConfidentFeature<Direction>;
  keyLightEstimate?: ConfidentFeature<string>;
  fillBehavior?: ConfidentFeature<'none' | 'low' | 'balanced' | 'strong' | 'unknown'>;
  rimPresence: ConfidentFeature<boolean>;
  shadowDirection?: ConfidentFeature<Direction>;
  shadowHardness: ConfidentFeature<NormalizedValue>;
  diffusion: ConfidentFeature<NormalizedValue>;
  specularBehavior: ConfidentFeature<string>;
  ambientIllumination: ConfidentFeature<NormalizedValue>;
  contrastRatioEstimate?: ConfidentFeature<number>;
  lightTemperature: ConfidentFeature<Temperature>;
  multipleLightSources: ConfidentFeature<boolean>;
  uncertainty: string[];
  evidenceIds: string[];
  confidence: NormalizedValue;
}

export type DepthCueType = 'scale' | 'overlap' | 'blur' | 'perspective' | 'lighting' | 'atmospheric_perspective' | 'occlusion';
export interface DepthCue {cue: DepthCueType; sourceRegionId?: string; targetRegionId?: string; strength: NormalizedValue; confidence: NormalizedValue; evidenceIds: string[]}
export interface DepthForensics {foregroundRegionIds: string[]; midgroundRegionIds: string[]; backgroundRegionIds: string[]; occlusionRelationshipIds: string[]; depthCues: DepthCue[]; focusHierarchy: string[]; blurHierarchy: string[]; relativeDepth: Array<{regionId: string; depth: NormalizedValue; confidence: NormalizedValue}>; strength: NormalizedValue; evidenceIds: string[]}

export interface MaterialForensics {regionId: string; roughness: ConfidentFeature<NormalizedValue>; glossiness: ConfidentFeature<NormalizedValue>; specularStrength: ConfidentFeature<NormalizedValue>; translucency: ConfidentFeature<NormalizedValue>; transparency: ConfidentFeature<NormalizedValue>; reflectivity: ConfidentFeature<NormalizedValue>; surfaceUniformity: ConfidentFeature<NormalizedValue>; microTexture: ConfidentFeature<NormalizedValue>; edgeBehavior: ConfidentFeature<string>; likelyMaterial?: ConfidentFeature<string>; evidenceIds: string[]; confidence: NormalizedValue}

export type SemanticCategory = 'person' | 'face' | 'product' | 'brand' | 'logo' | 'text_content' | 'location' | 'object' | 'scene' | 'narrative';
export interface SemanticObservation {id: string; category: SemanticCategory; description: string; confidence: NormalizedValue; region?: BoundingBox; relatedRegionIds?: string[]}
export interface SemanticFirewall {semanticObservations: SemanticObservation[]; excludedObservationIds: string[]; policy: SemanticExclusions}

export interface InferredDesignPrinciple {principleId: string; evidenceIds: string[]; confidence: NormalizedValue; explanation: string}
export type ContradictionResolutionStatus = 'unresolved' | 'review_required' | 'resolved' | 'accepted_ambiguity';
export interface AnalysisContradiction {id: string; statements: [string, string, ...string[]]; evidenceIds: string[]; severity: NormalizedValue; resolutionStatus: ContradictionResolutionStatus; resolution?: string}
export type UncertaintyReason = 'low_resolution' | 'occlusion' | 'ambiguous_visual_signal' | 'insufficient_evidence' | 'semantic_confusion' | 'lighting_ambiguity' | 'perspective_ambiguity' | 'unknown';
export interface AnalysisUncertainty {id: string; domain: ObservationDomain; description: string; reason: UncertaintyReason; confidence: NormalizedValue; impact: 'low' | 'medium' | 'high'; evidenceIds?: string[]}
export interface EvidenceQuality {coverage: NormalizedValue; consistency: NormalizedValue; measurementSupport: NormalizedValue; observationToInferenceRatio: NormalizedValue; speculationRisk: NormalizedValue; overall: NormalizedValue}

export type ForensicAntiAISignal = 'inconsistentLighting' | 'impossibleReflection' | 'overSymmetry' | 'fakeDepth' | 'excessiveGlow' | 'arbitraryDecoration' | 'hyperPerfectSurface' | 'genericAITexture' | 'perspectiveConflict';
export interface ForensicAntiAIFinding {signal: ForensicAntiAISignal; mappedKnowledgeSignalId: AntiAISignalId; evidenceIds: string[]; confidence: NormalizedValue; severity: NormalizedValue; explanation: string}

export interface VisualForensicsReport {
  schemaVersion: VisualForensicsSchemaVersion;
  metadata: ForensicsMetadata;
  canvas: CanvasAnalysis;
  observations: RawVisualObservation[];
  regions: VisualRegion[];
  relationships: VisualRelationship[];
  compositionAnalysis?: CompositionForensics;
  hierarchyAnalysis?: HierarchyForensics;
  spacingAnalysis?: SpacingForensics;
  colorAnalysis?: ColorForensics;
  typographyAnalysis?: TypographyForensics;
  lightingAnalysis?: LightingForensics;
  depthAnalysis?: DepthForensics;
  materialAnalysis?: MaterialForensics[];
  semanticContent: SemanticFirewall;
  semanticExclusions: SemanticExclusions;
  inferredPrinciples: InferredDesignPrinciple[];
  antiAiFindings: ForensicAntiAIFinding[];
  uncertainties: AnalysisUncertainty[];
  contradictions: AnalysisContradiction[];
  evidenceQuality: EvidenceQuality;
  overallConfidence: NormalizedValue;
}

export type VisualInput = {kind: 'url'; url: string} | {kind: 'base64'; data: string; mediaType: string} | {kind: 'bytes'; data: Uint8Array; mediaType: string};
export interface VisualForensicsInput {image: VisualInput; context?: string; semanticExclusions?: Partial<SemanticExclusions>; analysisDepth?: AnalysisDepth; language?: string}
export interface VisualForensicsExtractor {readonly name: string; readonly version?: string; analyze(input: VisualForensicsInput): Promise<VisualForensicsReport>}

export type AnalyticalPassId = 'raw_observation' | 'spatial_relationships' | 'domain_analysis' | 'principle_inference' | 'consistency_check' | 'design_dna_mapping';
export interface AnalyticalPass {id: AnalyticalPassId; order: number; requires: AnalyticalPassId[]; produces: string[]; minimumDepth: AnalysisDepth}
