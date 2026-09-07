export const DESIGN_DNA_SCHEMA_VERSION = '1.0.0' as const;

export type DesignDNASchemaVersion = typeof DESIGN_DNA_SCHEMA_VERSION;
export type NormalizedValue = number;

export interface BoundingBox {
  x: NormalizedValue;
  y: NormalizedValue;
  width: NormalizedValue;
  height: NormalizedValue;
}

export type InferenceLevel = 'observed' | 'strongly_inferred' | 'speculative';

export interface VisualEvidence {
  observation: string;
  region?: BoundingBox;
  confidence: NormalizedValue;
  inferenceLevel: InferenceLevel;
}

export interface EvidenceCollection {
  observedFacts: VisualEvidence[];
  inferredProperties: VisualEvidence[];
  uncertainProperties: VisualEvidence[];
}

export type DesignDomain =
  | 'composition'
  | 'visual_hierarchy'
  | 'grid'
  | 'spacing'
  | 'scale'
  | 'typography'
  | 'color'
  | 'lighting'
  | 'photography'
  | 'materials_and_finish'
  | 'texture'
  | 'geometry'
  | 'depth'
  | 'gestalt'
  | 'brand_language'
  | 'visual_history_and_movements';

export interface DesignPrinciple {
  id: string;
  name: string;
  domain: DesignDomain;
  description: string;
  professionalRationale: string;
  positiveSignals: string[];
  negativeSignals: string[];
  applicableContexts: string[];
  conflictsWith: string[];
}

export interface EvidenceBackedValue<T> {
  value: T;
  confidence: NormalizedValue;
  evidence: VisualEvidence[];
}

export interface NormalizedRange {
  min: NormalizedValue;
  max: NormalizedValue;
}

export interface FocalPoint {
  description: string;
  boundingBox?: BoundingBox;
  visualWeight: NormalizedValue;
  confidence: NormalizedValue;
  evidence?: VisualEvidence[];
}

export type Alignment = 'left' | 'center' | 'right' | 'justified' | 'mixed';
export type Direction = 'up' | 'down' | 'left' | 'right' | 'inward' | 'outward' | 'mixed' | 'none';
export type GridType = 'modular' | 'column' | 'baseline' | 'manuscript' | 'rule_of_thirds' | 'golden_ratio' | 'z_pattern' | 'f_pattern' | 'radial' | 'freeform_editorial' | 'none';
export type Temperature = 'warm' | 'neutral' | 'cool' | 'mixed';

export interface DesignDNAMetadata {
  id?: string;
  createdAt?: string;
  sourceId?: string;
  extractor?: {name: string; version?: string};
  notes?: string[];
}

export interface SourceAnalysis {
  sourceType: 'image' | 'frame' | 'document' | 'unknown';
  width?: number;
  height?: number;
  aspectRatio?: number;
  overallDescription?: string;
}

export interface CompositionDNA {
  balance: EvidenceBackedValue<'symmetric' | 'asymmetric' | 'radial' | 'dynamic' | 'ambiguous'>;
  centerOfGravity?: EvidenceBackedValue<{x: NormalizedValue; y: NormalizedValue}>;
  directionalFlow?: EvidenceBackedValue<Direction[]>;
  focalPlacement?: FocalPoint[];
  visualMass?: EvidenceBackedValue<NormalizedValue>;
  edgeTension?: EvidenceBackedValue<NormalizedEdgeTension>;
  cropping?: EvidenceBackedValue<'none' | 'conservative' | 'intentional' | 'aggressive'>;
  framing?: string[];
  layering?: EvidenceBackedValue<NormalizedValue>;
  overlap?: EvidenceBackedValue<NormalizedValue>;
}

export interface NormalizedEdgeTension {
  top: NormalizedValue;
  right: NormalizedValue;
  bottom: NormalizedValue;
  left: NormalizedValue;
}

export interface VisualHierarchyDNA {
  primaryFocus?: FocalPoint;
  secondaryFocus?: FocalPoint[];
  tertiaryFocus?: FocalPoint[];
  eyeEntryPoint?: FocalPoint;
  eyeExitPoint?: FocalPoint;
  readingOrder: FocalPoint[];
  attentionAnchors: FocalPoint[];
  contrastHierarchy?: string[];
  informationHierarchy?: string[];
}

export interface GridDNA {
  type: EvidenceBackedValue<GridType>;
  columns?: number;
  rows?: number;
  alignment: Alignment;
  adherence: NormalizedValue;
  visibleStructure?: BoundingBox[];
}

export interface SpacingDNA {
  negativeSpaceRatio: NormalizedValue;
  activeSpaceRatio?: NormalizedValue;
  passiveSpaceRatio?: NormalizedValue;
  marginRatio?: NormalizedEdgeTension;
  gutterRatio?: NormalizedValue;
  paddingRhythm?: 'consistent' | 'progressive' | 'irregular' | 'unknown';
  proximityStrength?: NormalizedValue;
  density: NormalizedValue;
}

export interface ScaleDNA {
  heroScale?: NormalizedValue;
  typeScaleRatio?: number;
  logoScale?: NormalizedValue;
  objectToCanvasRatio?: NormalizedValue;
  foregroundBackgroundRatio?: number;
  scaleContrast: NormalizedValue;
  dominanceThroughScale: NormalizedValue;
}

export interface TypographySample {
  role: 'headline' | 'subheadline' | 'body' | 'caption' | 'label' | 'display' | 'unknown';
  classification: 'serif' | 'sans_serif' | 'slab_serif' | 'script' | 'display' | 'monospace' | 'mixed' | 'unknown';
  personality: string[];
  weight?: number;
  width?: 'condensed' | 'normal' | 'extended' | 'variable' | 'unknown';
  xHeight?: 'low' | 'medium' | 'high' | 'unknown';
  strokeContrast?: NormalizedValue;
  tracking?: 'tight' | 'normal' | 'wide' | 'mixed';
  leadingRatio?: number;
  lineLengthCharacters?: NormalizedRange;
  case?: 'uppercase' | 'lowercase' | 'title' | 'sentence' | 'mixed';
  alignment?: Alignment;
  boundingBox?: BoundingBox;
  confidence: NormalizedValue;
}

export interface TypographyDNA {
  samples: TypographySample[];
  hierarchy: string[];
  opticalSizing?: boolean;
  headlineBehavior?: string[];
  textDensity: NormalizedValue;
  typographicContrast: NormalizedValue;
}

export interface ColorSample {
  hex?: string;
  role: 'dominant' | 'supporting' | 'accent' | 'background' | 'foreground';
  coverage: NormalizedValue;
  luminance: NormalizedValue;
  saturation: NormalizedValue;
  temperature: Temperature;
  confidence: NormalizedValue;
}

export interface ColorDNA {
  palette: ColorSample[];
  hueRelationship: 'monochromatic' | 'analogous' | 'complementary' | 'split_complementary' | 'triadic' | 'tetradic' | 'neutral' | 'mixed' | 'unknown';
  contrast: NormalizedValue;
  foregroundBackgroundSeparation: NormalizedValue;
  tonalHierarchy: string[];
  brandDominance: NormalizedValue;
}

export interface LightingDNA {
  keyLight?: {direction: Direction; size: NormalizedValue; softness: NormalizedValue};
  fillIntensity?: NormalizedValue;
  rimIntensity?: NormalizedValue;
  shadowHardness?: NormalizedValue;
  shadowDirection?: Direction;
  specularIntensity?: NormalizedValue;
  diffusion?: NormalizedValue;
  bounce?: NormalizedValue;
  ambientIllumination?: NormalizedValue;
  colorTemperature: Temperature;
  contrastRatio?: number;
  confidence: NormalizedValue;
}

export interface PhotographyDNA {
  focalLengthCharacter: 'ultra_wide' | 'wide' | 'normal' | 'portrait' | 'telephoto' | 'mixed' | 'not_applicable' | 'unknown';
  cameraAngle: 'eye_level' | 'high' | 'low' | 'top_down' | 'dutch' | 'mixed' | 'not_applicable' | 'unknown';
  perspective: 'flat' | 'natural' | 'exaggerated' | 'compressed' | 'isometric' | 'mixed' | 'unknown';
  depthOfField: NormalizedValue;
  focusHierarchy: string[];
  exposureCharacter: 'low_key' | 'balanced' | 'high_key' | 'mixed';
  behavior: 'editorial' | 'commercial' | 'documentary' | 'artistic' | 'hybrid' | 'not_applicable';
  crop: 'loose' | 'standard' | 'tight' | 'aggressive' | 'mixed';
  subjectIsolation: NormalizedValue;
  lensDistortion: NormalizedValue;
  confidence: NormalizedValue;
}

export interface MaterialObservation {
  material: 'matte' | 'gloss' | 'satin' | 'metallic' | 'translucent' | 'transparent' | 'rough' | 'polished' | 'paper' | 'plastic' | 'glass' | 'chrome' | 'textile' | 'natural' | 'unknown';
  description?: string;
  region?: BoundingBox;
  confidence: NormalizedValue;
}

export interface TextureObservation {
  type: 'grain' | 'noise' | 'halftone' | 'paper' | 'film_grain' | 'surface_imperfection' | 'other';
  density: NormalizedValue;
  tactileContrast: NormalizedValue;
  region?: BoundingBox;
  confidence: NormalizedValue;
}

export interface GeometryDNA {
  organicGeometricBalance: NormalizedValue;
  angularity: NormalizedValue;
  curvature: NormalizedValue;
  repetition: NormalizedValue;
  modularity: NormalizedValue;
  shapeLanguage: string[];
  silhouettes: string[];
  contourBehavior: string[];
}

export interface DepthDNA {
  foreground?: VisualEvidence[];
  midground?: VisualEvidence[];
  background?: VisualEvidence[];
  occlusion: NormalizedValue;
  atmosphericPerspective: NormalizedValue;
  blurHierarchy: NormalizedValue;
  spatialLayering: NormalizedValue;
  ambientOcclusion: NormalizedValue;
}

export type GestaltPrinciple = 'proximity' | 'similarity' | 'continuity' | 'closure' | 'figure_ground' | 'common_region' | 'connectedness' | 'symmetry' | 'pragnanz';

export interface GestaltDNA {
  principles: Array<{principle: GestaltPrinciple; strength: NormalizedValue; evidence: VisualEvidence[]}>;
}

export interface BrandLanguageDNA {
  personality: string[];
  positioning?: string;
  perceivedPriceLevel: NormalizedValue;
  sophistication: NormalizedValue;
  accessibility: NormalizedValue;
  innovation: NormalizedValue;
  trust: NormalizedValue;
  energy: NormalizedValue;
  restraint: NormalizedValue;
  distinctiveness: NormalizedValue;
}

export type VisualMovementId = 'swiss' | 'bauhaus' | 'constructivism' | 'modernism' | 'mid_century_modern' | 'brutalism' | 'postmodernism' | 'memphis' | 'editorial_minimalism' | 'luxury_editorial' | 'japanese_graphic_design' | 'contemporary_fashion' | 'tech_minimalism' | 'neo_brutalism' | 'contemporary_commercial_design';

export interface VisualMovementInfluence {
  movementId: VisualMovementId;
  strength: NormalizedValue;
  matchedPrincipleIds: string[];
  evidence: VisualEvidence[];
  confidence: NormalizedValue;
}

export interface SemanticExclusionItem {
  exclude: boolean;
  descriptions?: string[];
  reason?: string;
}

export interface SemanticExclusions {
  humanIdentity: SemanticExclusionItem;
  faces: SemanticExclusionItem;
  literalPeople: SemanticExclusionItem;
  literalProducts: SemanticExclusionItem;
  literalBrands: SemanticExclusionItem;
  writtenText: SemanticExclusionItem;
  logos: SemanticExclusionItem;
  specificLocations: SemanticExclusionItem;
  specificObjects: SemanticExclusionItem;
  narrativeMeaning: SemanticExclusionItem;
}

export const ANTI_AI_SIGNAL_IDS = [
  'unjustified_perfect_symmetry', 'excessive_cinematic_fog', 'unnecessary_volumetric_light',
  'arbitrary_neon', 'excessive_bloom', 'excessive_rim_lighting', 'hyper_perfect_surfaces',
  'random_floating_particles', 'purposeless_decoration', 'impossible_reflections',
  'physically_inconsistent_shadows', 'excessive_local_contrast', 'excessive_sharpening',
  'arbitrary_gradients', 'generic_futuristic_geometry', 'plastic_skin', 'meaningless_micro_details',
  'excessive_bokeh', 'fake_depth_of_field', 'excessive_glow', 'unnecessary_3d_objects',
  'over_compositing', 'inconsistent_perspective', 'inconsistent_light_sources',
] as const;

export type AntiAISignalId = (typeof ANTI_AI_SIGNAL_IDS)[number];

export interface AntiAISignalAssessment {
  signalId: AntiAISignalId;
  severity: NormalizedValue;
  confidence: NormalizedValue;
  reason: string;
  suggestedCorrection: string;
  evidence?: VisualEvidence[];
}

export interface AntiAIAssessment {
  signals: AntiAISignalAssessment[];
  positivePrinciples: Array<{principleId: string; strength: NormalizedValue; confidence: NormalizedValue; evidence?: VisualEvidence[]}>;
  overallRisk: NormalizedValue;
  confidence: NormalizedValue;
}

export type ProfessionalMetricId = 'negativeSpaceRatio' | 'visualDensity' | 'symmetryScore' | 'compositionTension' | 'hierarchyClarity' | 'typographicContrast' | 'colorContrastStrength' | 'depthStrength' | 'brandDistinctiveness' | 'visualSophistication' | 'aiArtifactRisk';

export interface ProfessionalMetric {
  value: NormalizedValue;
  confidence: NormalizedValue;
  evidence?: VisualEvidence[];
}

export type ProfessionalMetrics = Record<ProfessionalMetricId, ProfessionalMetric>;

export interface DesignDNA {
  schemaVersion: DesignDNASchemaVersion;
  metadata: DesignDNAMetadata;
  sourceAnalysis?: SourceAnalysis;
  composition?: CompositionDNA;
  visualHierarchy?: VisualHierarchyDNA;
  grid?: GridDNA;
  spacing?: SpacingDNA;
  scale?: ScaleDNA;
  typography?: TypographyDNA;
  color?: ColorDNA;
  lighting?: LightingDNA;
  photography?: PhotographyDNA;
  materials?: MaterialObservation[];
  textures?: TextureObservation[];
  geometry?: GeometryDNA;
  depth?: DepthDNA;
  gestalt?: GestaltDNA;
  brandLanguage?: BrandLanguageDNA;
  visualMovementInfluence?: VisualMovementInfluence[];
  antiAiAssessment?: AntiAIAssessment;
  semanticExclusions: SemanticExclusions;
  evidence: EvidenceCollection;
  metrics?: Partial<ProfessionalMetrics>;
  confidence: NormalizedValue;
}
