import {
  createSemanticExclusions,
  isBoundingBox,
  validateSemanticExclusions,
  validateVisualEvidence,
  type SemanticExclusions,
  type ValidationIssue,
  type ValidationResult,
} from '../art-direction';
import {
  VISUAL_FORENSICS_SCHEMA_VERSION,
  type CanvasAnalysis,
  type EvidenceQuality,
  type ForensicsMetadata,
  type VisualForensicsReport,
} from './types';

const NORMALIZED_KEYS = new Set([
  'confidence', 'overallConfidence', 'areaRatio', 'visualWeight', 'salience', 'contrastAgainstEnvironment',
  'strength', 'contribution', 'score', 'clarity', 'negativeSpaceRatio', 'activeRatio', 'passiveRatio',
  'purposePotential', 'balanceContribution', 'textPlacementPotential', 'breathingRoom', 'alignmentRhythm',
  'spacingConsistency', 'density', 'textBlockDensity', 'scaleRelationship', 'estimatedCoverage',
  'relativeLuminance', 'saturation', 'backgroundForegroundContrast', 'coverage',
  'symmetryScore', 'asymmetryStrength', 'overlapStrength', 'layeringStrength', 'depth', 'severity',
  'consistency', 'measurementSupport', 'observationToInferenceRatio', 'speculationRisk', 'overall',
]);
const CONFIDENT_NORMALIZED_KEYS = new Set(['roughness', 'glossiness', 'specularStrength', 'translucency', 'transparency', 'reflectivity', 'surfaceUniformity', 'microTexture', 'shadowHardness', 'diffusion', 'ambientIllumination']);
const ANALYSIS_DEPTHS = ['quick', 'standard', 'deep', 'forensic'];
const RESOLUTION_STATUSES = ['unresolved', 'review_required', 'resolved', 'accepted_ambiguity'];
const UNCERTAINTY_REASONS = ['low_resolution', 'occlusion', 'ambiguous_visual_signal', 'insufficient_evidence', 'semantic_confusion', 'lighting_ambiguity', 'perspective_ambiguity', 'unknown'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const issue = (issues: ValidationIssue[], path: string, message: string): void => { issues.push({path, message}); };
const normalized = (value: unknown, path: string, issues: ValidationIssue[]): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) issue(issues, path, 'Must be a finite number between 0 and 1.');
};

const walkNormalized = (value: unknown, path: string, issues: ValidationIssue[]): void => {
  if (Array.isArray(value)) return value.forEach((entry, index) => walkNormalized(entry, `${path}[${index}]`, issues));
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if ((key === 'boundingBox' || key === 'region' || key === 'estimatedSafeArea') && child !== undefined) {
      if (!isBoundingBox(child)) issue(issues, childPath, 'Must be a normalized bounding box contained within the canvas.');
      continue;
    }
    if (NORMALIZED_KEYS.has(key) && child !== undefined) normalized(child, childPath, issues);
    if (CONFIDENT_NORMALIZED_KEYS.has(key) && isRecord(child)) normalized(child.value, `${childPath}.value`, issues);
    if ((key === 'visualCenter' || key === 'centroid' || key === 'point' || key === 'visualCenterOfGravity') && isRecord(child)) {
      normalized(child.x, `${childPath}.x`, issues);
      normalized(child.y, `${childPath}.y`, issues);
    }
    if (key === 'edgeProximity' || key === 'edgeTension' || key === 'edgePressure') {
      if (!isRecord(child)) issue(issues, childPath, 'Must contain normalized top, right, bottom, and left values.');
      else for (const edge of ['top', 'right', 'bottom', 'left']) normalized(child[edge], `${childPath}.${edge}`, issues);
    }
    walkNormalized(child, childPath, issues);
  }
};

const validateCanvas = (value: unknown, issues: ValidationIssue[]): void => {
  if (!isRecord(value)) return issue(issues, 'canvas', 'Canvas analysis is required.');
  if (typeof value.width !== 'number' || value.width <= 0) issue(issues, 'canvas.width', 'Must be greater than 0.');
  if (typeof value.height !== 'number' || value.height <= 0) issue(issues, 'canvas.height', 'Must be greater than 0.');
  if (typeof value.aspectRatio !== 'number' || value.aspectRatio <= 0) issue(issues, 'canvas.aspectRatio', 'Must be greater than 0.');
  if (!['portrait', 'landscape', 'square'].includes(String(value.orientation))) issue(issues, 'canvas.orientation', 'Invalid orientation.');
};

const validateReferences = (report: Record<string, unknown>, issues: ValidationIssue[]): void => {
  const observations = Array.isArray(report.observations) ? report.observations.filter(isRecord) : [];
  const regions = Array.isArray(report.regions) ? report.regions.filter(isRecord) : [];
  const observationIds = new Set(observations.map(({id}) => id).filter((id): id is string => typeof id === 'string'));
  const regionIds = new Set(regions.map(({id}) => id).filter((id): id is string => typeof id === 'string'));
  if (observationIds.size !== observations.length) issue(issues, 'observations', 'Observation IDs must be non-empty and unique.');
  if (regionIds.size !== regions.length) issue(issues, 'regions', 'Region IDs must be non-empty and unique.');

  observations.forEach((observation, index) => {
    if (observation.inferenceLevel !== 'observed') issue(issues, `observations[${index}].inferenceLevel`, 'Raw observations must use observed.');
    for (const regionId of Array.isArray(observation.relatedRegionIds) ? observation.relatedRegionIds : []) {
      if (!regionIds.has(regionId)) issue(issues, `observations[${index}].relatedRegionIds`, `Unknown region ID: ${String(regionId)}.`);
    }
  });

  const relationships = Array.isArray(report.relationships) ? report.relationships : [];
  relationships.forEach((relationship, index) => {
    const path = `relationships[${index}]`;
    if (!isRecord(relationship)) return issue(issues, path, 'Must be a relationship object.');
    if (!regionIds.has(relationship.sourceRegionId as string)) issue(issues, `${path}.sourceRegionId`, 'Must reference an existing region.');
    if (!regionIds.has(relationship.targetRegionId as string)) issue(issues, `${path}.targetRegionId`, 'Must reference an existing region.');
    if (relationship.sourceRegionId === relationship.targetRegionId) issue(issues, path, 'Source and target regions must differ.');
    for (const evidenceId of Array.isArray(relationship.evidenceIds) ? relationship.evidenceIds : []) {
      if (!observationIds.has(evidenceId)) issue(issues, `${path}.evidenceIds`, `Unknown observation ID: ${String(evidenceId)}.`);
    }
    if (!Array.isArray(relationship.evidence)) issue(issues, `${path}.evidence`, 'Must be an evidence array.');
    else relationship.evidence.forEach((entry, evidenceIndex) => issues.push(...validateVisualEvidence(entry, `${path}.evidence[${evidenceIndex}]`)));
  });

  for (const [collectionName, collection] of [['inferredPrinciples', report.inferredPrinciples], ['antiAiFindings', report.antiAiFindings], ['contradictions', report.contradictions]] as const) {
    if (!Array.isArray(collection)) continue;
    collection.filter(isRecord).forEach((entry, index) => {
      for (const evidenceId of Array.isArray(entry.evidenceIds) ? entry.evidenceIds : []) {
        if (!observationIds.has(evidenceId)) issue(issues, `${collectionName}[${index}].evidenceIds`, `Unknown observation ID: ${String(evidenceId)}.`);
      }
    });
  }
};

export const validateVisualForensicsReport = (value: unknown): ValidationResult<VisualForensicsReport> => {
  if (!isRecord(value)) return {success: false, issues: [{path: '', message: 'VisualForensicsReport must be an object.'}]};
  const issues: ValidationIssue[] = [];
  if (value.schemaVersion !== VISUAL_FORENSICS_SCHEMA_VERSION) issue(issues, 'schemaVersion', `Must equal ${VISUAL_FORENSICS_SCHEMA_VERSION}.`);
  if (!isRecord(value.metadata)) issue(issues, 'metadata', 'Metadata is required.');
  else if (!ANALYSIS_DEPTHS.includes(String(value.metadata.analysisDepth))) issue(issues, 'metadata.analysisDepth', 'Invalid analysis depth.');
  validateCanvas(value.canvas, issues);
  for (const key of ['observations', 'regions', 'relationships', 'inferredPrinciples', 'antiAiFindings', 'uncertainties', 'contradictions']) {
    if (!Array.isArray(value[key])) issue(issues, key, 'Must be an array.');
  }
  issues.push(...validateSemanticExclusions(value.semanticExclusions));
  if (!isRecord(value.semanticContent)) issue(issues, 'semanticContent', 'Semantic firewall is required.');
  else {
    if (!Array.isArray(value.semanticContent.semanticObservations)) issue(issues, 'semanticContent.semanticObservations', 'Must be an array.');
    if (!Array.isArray(value.semanticContent.excludedObservationIds)) issue(issues, 'semanticContent.excludedObservationIds', 'Must be an array.');
    issues.push(...validateSemanticExclusions(value.semanticContent.policy, 'semanticContent.policy'));
  }
  if (!isRecord(value.evidenceQuality)) issue(issues, 'evidenceQuality', 'Evidence quality is required.');
  if (Array.isArray(value.contradictions)) value.contradictions.forEach((entry, index) => {
    if (!isRecord(entry) || !Array.isArray(entry.statements) || entry.statements.length < 2) issue(issues, `contradictions[${index}].statements`, 'At least two statements are required.');
    else if (!RESOLUTION_STATUSES.includes(String(entry.resolutionStatus))) issue(issues, `contradictions[${index}].resolutionStatus`, 'Invalid resolution status.');
  });
  if (Array.isArray(value.uncertainties)) value.uncertainties.forEach((entry, index) => {
    if (!isRecord(entry) || !UNCERTAINTY_REASONS.includes(String(entry.reason))) issue(issues, `uncertainties[${index}].reason`, 'Invalid uncertainty reason.');
  });
  walkNormalized(value, '', issues);
  validateReferences(value, issues);
  return issues.length ? {success: false, issues} : {success: true, data: value as unknown as VisualForensicsReport};
};

export const assertVisualForensicsReport = (value: unknown): asserts value is VisualForensicsReport => {
  const result = validateVisualForensicsReport(value);
  if (result.success === false) throw new TypeError(`Invalid VisualForensicsReport:\n${result.issues.map(({path, message}) => `- ${path || '<root>'}: ${message}`).join('\n')}`);
};

export const createEvidenceQuality = (): EvidenceQuality => ({coverage: 0, consistency: 0, measurementSupport: 0, observationToInferenceRatio: 1, speculationRisk: 0, overall: 0});

export const createMinimalVisualForensicsReport = (
  metadata: Partial<ForensicsMetadata> = {},
  semanticExclusions: SemanticExclusions = createSemanticExclusions(),
): VisualForensicsReport => {
  const canvas: CanvasAnalysis = {width: 1, height: 1, aspectRatio: 1, orientation: 'square', visualCenter: {x: 0.5, y: 0.5}, opticalCenter: {point: {x: 0.5, y: 0.5}, confidence: 0, evidenceIds: []}};
  return {schemaVersion: VISUAL_FORENSICS_SCHEMA_VERSION, metadata: {analysisDepth: 'quick', ...metadata}, canvas, observations: [], regions: [], relationships: [], semanticContent: {semanticObservations: [], excludedObservationIds: [], policy: semanticExclusions}, semanticExclusions, inferredPrinciples: [], antiAiFindings: [], uncertainties: [], contradictions: [], evidenceQuality: createEvidenceQuality(), overallConfidence: 0};
};
