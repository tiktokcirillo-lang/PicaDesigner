import {
  ANTI_AI_SIGNAL_IDS,
  DESIGN_DNA_SCHEMA_VERSION,
  type AntiAIAssessment,
  type BoundingBox,
  type DesignDNA,
  type EvidenceCollection,
  type InferenceLevel,
  type SemanticExclusions,
  type VisualEvidence,
} from './types';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | {success: true; data: T}
  | {success: false; issues: ValidationIssue[]};

const INFERENCE_LEVELS: readonly InferenceLevel[] = ['observed', 'strongly_inferred', 'speculative'];
const SEMANTIC_KEYS = ['humanIdentity', 'faces', 'literalPeople', 'literalProducts', 'literalBrands', 'writtenText', 'logos', 'specificLocations', 'specificObjects', 'narrativeMeaning'] as const;
const NORMALIZED_KEYS = new Set([
  'confidence', 'visualWeight', 'top', 'right', 'bottom', 'left',
  'adherence', 'negativeSpaceRatio', 'activeSpaceRatio', 'passiveSpaceRatio', 'gutterRatio',
  'proximityStrength', 'density', 'heroScale', 'logoScale', 'objectToCanvasRatio', 'scaleContrast',
  'dominanceThroughScale', 'strokeContrast', 'textDensity', 'typographicContrast', 'coverage',
  'luminance', 'saturation', 'contrast', 'foregroundBackgroundSeparation', 'brandDominance', 'size',
  'softness', 'fillIntensity', 'rimIntensity', 'shadowHardness', 'specularIntensity', 'diffusion',
  'bounce', 'ambientIllumination', 'depthOfField', 'subjectIsolation', 'lensDistortion', 'tactileContrast',
  'organicGeometricBalance', 'angularity', 'curvature', 'repetition', 'modularity', 'occlusion',
  'atmosphericPerspective', 'blurHierarchy', 'spatialLayering', 'ambientOcclusion', 'strength',
  'perceivedPriceLevel', 'sophistication', 'accessibility', 'innovation', 'trust', 'energy', 'restraint',
  'distinctiveness', 'severity', 'overallRisk',
]);
const EVIDENCE_BACKED_NORMALIZED_KEYS = new Set(['visualMass', 'layering', 'overlap']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const addIssue = (issues: ValidationIssue[], path: string, message: string): void => {
  issues.push({path, message});
};

const validateNormalized = (value: unknown, path: string, issues: ValidationIssue[]): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    addIssue(issues, path, 'Must be a finite number between 0 and 1.');
  }
};

const validateBoundingBoxAt = (value: unknown, path: string, issues: ValidationIssue[]): void => {
  if (!isRecord(value)) {
    addIssue(issues, path, 'Must be a bounding box object.');
    return;
  }
  for (const key of ['x', 'y', 'width', 'height'] as const) validateNormalized(value[key], `${path}.${key}`, issues);
  if (typeof value.x === 'number' && typeof value.width === 'number' && value.x + value.width > 1) {
    addIssue(issues, path, 'x + width must not exceed 1.');
  }
  if (typeof value.y === 'number' && typeof value.height === 'number' && value.y + value.height > 1) {
    addIssue(issues, path, 'y + height must not exceed 1.');
  }
};

const walkConstraints = (value: unknown, path: string, issues: ValidationIssue[]): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkConstraints(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key === 'boundingBox' || key === 'region') {
      if (child !== undefined) validateBoundingBoxAt(child, childPath, issues);
      continue;
    }
    if (EVIDENCE_BACKED_NORMALIZED_KEYS.has(key) && isRecord(child)) {
      validateNormalized(child.value, `${childPath}.value`, issues);
    }
    if (NORMALIZED_KEYS.has(key) && child !== undefined) validateNormalized(child, childPath, issues);
    walkConstraints(child, childPath, issues);
  }
};

export const isBoundingBox = (value: unknown): value is BoundingBox => {
  const issues: ValidationIssue[] = [];
  validateBoundingBoxAt(value, 'boundingBox', issues);
  return issues.length === 0;
};

export const validateVisualEvidence = (value: unknown, path = 'evidence'): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return [{path, message: 'Must be an evidence object.'}];
  if (typeof value.observation !== 'string' || value.observation.trim() === '') addIssue(issues, `${path}.observation`, 'A non-empty observation is required.');
  validateNormalized(value.confidence, `${path}.confidence`, issues);
  if (!INFERENCE_LEVELS.includes(value.inferenceLevel as InferenceLevel)) addIssue(issues, `${path}.inferenceLevel`, 'Must be observed, strongly_inferred, or speculative.');
  if (value.region !== undefined) validateBoundingBoxAt(value.region, `${path}.region`, issues);
  return issues;
};

export const validateEvidenceCollection = (value: unknown, path = 'evidence'): ValidationIssue[] => {
  if (!isRecord(value)) return [{path, message: 'Must be an evidence collection.'}];
  const issues: ValidationIssue[] = [];
  for (const key of ['observedFacts', 'inferredProperties', 'uncertainProperties'] as const) {
    const entries = value[key];
    if (!Array.isArray(entries)) {
      addIssue(issues, `${path}.${key}`, 'Must be an array.');
      continue;
    }
    entries.forEach((entry, index) => issues.push(...validateVisualEvidence(entry, `${path}.${key}[${index}]`)));
  }
  return issues;
};

export const validateSemanticExclusions = (value: unknown, path = 'semanticExclusions'): ValidationIssue[] => {
  if (!isRecord(value)) return [{path, message: 'Must be a semantic exclusions object.'}];
  const issues: ValidationIssue[] = [];
  for (const key of SEMANTIC_KEYS) {
    const item = value[key];
    if (!isRecord(item)) {
      addIssue(issues, `${path}.${key}`, 'Must be an exclusion item.');
      continue;
    }
    if (typeof item.exclude !== 'boolean') addIssue(issues, `${path}.${key}.exclude`, 'Must be boolean.');
    if (item.descriptions !== undefined && (!Array.isArray(item.descriptions) || item.descriptions.some((entry) => typeof entry !== 'string'))) {
      addIssue(issues, `${path}.${key}.descriptions`, 'Must be an array of strings.');
    }
  }
  return issues;
};

export const validateAntiAIAssessment = (value: unknown, path = 'antiAiAssessment'): ValidationIssue[] => {
  if (!isRecord(value)) return [{path, message: 'Must be an Anti-AI assessment object.'}];
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(value.signals)) addIssue(issues, `${path}.signals`, 'Must be an array.');
  else value.signals.forEach((entry, index) => {
    const itemPath = `${path}.signals[${index}]`;
    if (!isRecord(entry)) return addIssue(issues, itemPath, 'Must be a signal assessment.');
    if (!ANTI_AI_SIGNAL_IDS.includes(entry.signalId as (typeof ANTI_AI_SIGNAL_IDS)[number])) addIssue(issues, `${itemPath}.signalId`, 'Unknown Anti-AI signal.');
    validateNormalized(entry.severity, `${itemPath}.severity`, issues);
    validateNormalized(entry.confidence, `${itemPath}.confidence`, issues);
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') addIssue(issues, `${itemPath}.reason`, 'A reason is required.');
    if (typeof entry.suggestedCorrection !== 'string' || entry.suggestedCorrection.trim() === '') addIssue(issues, `${itemPath}.suggestedCorrection`, 'A correction is required.');
  });
  if (!Array.isArray(value.positivePrinciples)) addIssue(issues, `${path}.positivePrinciples`, 'Must be an array.');
  validateNormalized(value.overallRisk, `${path}.overallRisk`, issues);
  validateNormalized(value.confidence, `${path}.confidence`, issues);
  walkConstraints(value.positivePrinciples, `${path}.positivePrinciples`, issues);
  return issues;
};

export const validateDesignDNA = (value: unknown): ValidationResult<DesignDNA> => {
  if (!isRecord(value)) return {success: false, issues: [{path: '', message: 'DesignDNA must be an object.'}]};
  const issues: ValidationIssue[] = [];
  if (value.schemaVersion !== DESIGN_DNA_SCHEMA_VERSION) addIssue(issues, 'schemaVersion', `Must equal ${DESIGN_DNA_SCHEMA_VERSION}.`);
  if (!isRecord(value.metadata)) addIssue(issues, 'metadata', 'Metadata is required.');
  issues.push(...validateSemanticExclusions(value.semanticExclusions));
  issues.push(...validateEvidenceCollection(value.evidence));
  validateNormalized(value.confidence, 'confidence', issues);
  if (value.antiAiAssessment !== undefined) issues.push(...validateAntiAIAssessment(value.antiAiAssessment));
  if (isRecord(value.metrics)) {
    for (const [metricId, metric] of Object.entries(value.metrics)) {
      if (!isRecord(metric)) addIssue(issues, `metrics.${metricId}`, 'Must be a professional metric object.');
      else validateNormalized(metric.value, `metrics.${metricId}.value`, issues);
    }
  }
  if (isRecord(value.composition) && isRecord(value.composition.centerOfGravity) && isRecord(value.composition.centerOfGravity.value)) {
    validateNormalized(value.composition.centerOfGravity.value.x, 'composition.centerOfGravity.value.x', issues);
    validateNormalized(value.composition.centerOfGravity.value.y, 'composition.centerOfGravity.value.y', issues);
  }
  walkConstraints(value, '', issues);
  return issues.length === 0 ? {success: true, data: value as unknown as DesignDNA} : {success: false, issues};
};

export const assertDesignDNA = (value: unknown): asserts value is DesignDNA => {
  const result = validateDesignDNA(value);
  if (result.success === false) {
    throw new TypeError(`Invalid DesignDNA:\n${result.issues.map(({path, message}) => `- ${path || '<root>'}: ${message}`).join('\n')}`);
  }
};

const exclusionItem = () => ({exclude: false});

export const createSemanticExclusions = (): SemanticExclusions => ({
  humanIdentity: exclusionItem(), faces: exclusionItem(), literalPeople: exclusionItem(),
  literalProducts: exclusionItem(), literalBrands: exclusionItem(), writtenText: exclusionItem(),
  logos: exclusionItem(), specificLocations: exclusionItem(), specificObjects: exclusionItem(),
  narrativeMeaning: exclusionItem(),
});

export const createEvidenceCollection = (): EvidenceCollection => ({
  observedFacts: [], inferredProperties: [], uncertainProperties: [],
});

export const createMinimalDesignDNA = (metadata: DesignDNA['metadata'] = {}): DesignDNA => ({
  schemaVersion: DESIGN_DNA_SCHEMA_VERSION,
  metadata,
  semanticExclusions: createSemanticExclusions(),
  evidence: createEvidenceCollection(),
  confidence: 0,
});

export const createVisualEvidence = (
  observation: string,
  confidence: number,
  inferenceLevel: InferenceLevel,
  region?: BoundingBox,
): VisualEvidence => ({observation, confidence, inferenceLevel, ...(region ? {region} : {})});

export type {AntiAIAssessment};
