import {
  createEvidenceCollection,
  createMinimalDesignDNA,
  createSemanticExclusions,
  validateAntiAIAssessment,
  validateDesignDNA,
  validateSemanticExclusions,
} from './schemas.js';
import {DESIGN_DNA_SCHEMA_VERSION, type DesignDNA} from './types.js';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`DesignDNA validation check failed: ${message}`);
};

const antiAiAssessment = {
  signals: [{
    signalId: 'excessive_glow' as const,
    severity: 0.4,
    confidence: 0.8,
    reason: 'Glow extends beyond the only emissive element.',
    suggestedCorrection: 'Confine glow to the emissive edge and nearby spill.',
  }],
  positivePrinciples: [{principleId: 'anti-ai.meaningful-contrast', strength: 0.7, confidence: 0.8}],
  overallRisk: 0.4,
  confidence: 0.8,
};

const completeDesignDNA: DesignDNA = {
  schemaVersion: DESIGN_DNA_SCHEMA_VERSION,
  metadata: {id: 'validation-fixture', createdAt: '2026-01-01T00:00:00.000Z'},
  sourceAnalysis: {sourceType: 'image', width: 1200, height: 1500, aspectRatio: 0.8},
  composition: {balance: {value: 'asymmetric', confidence: 0.9, evidence: []}, visualMass: {value: 0.6, confidence: 0.7, evidence: []}},
  visualHierarchy: {primaryFocus: {description: 'Headline', visualWeight: 0.9, confidence: 0.9, boundingBox: {x: 0.1, y: 0.1, width: 0.5, height: 0.2}}, readingOrder: [], attentionAnchors: []},
  grid: {type: {value: 'column', confidence: 0.8, evidence: []}, columns: 6, alignment: 'left', adherence: 0.8},
  spacing: {negativeSpaceRatio: 0.45, density: 0.5},
  scale: {scaleContrast: 0.8, dominanceThroughScale: 0.8},
  typography: {samples: [], hierarchy: ['headline', 'body'], textDensity: 0.4, typographicContrast: 0.8},
  color: {palette: [{role: 'dominant', coverage: 0.7, luminance: 0.2, saturation: 0.1, temperature: 'neutral', confidence: 0.9}], hueRelationship: 'neutral', contrast: 0.8, foregroundBackgroundSeparation: 0.9, tonalHierarchy: ['light text', 'dark ground'], brandDominance: 0.6},
  lighting: {colorTemperature: 'neutral', confidence: 0.6},
  photography: {focalLengthCharacter: 'not_applicable', cameraAngle: 'not_applicable', perspective: 'flat', depthOfField: 0, focusHierarchy: [], exposureCharacter: 'balanced', behavior: 'not_applicable', crop: 'standard', subjectIsolation: 0, lensDistortion: 0, confidence: 0.8},
  materials: [{material: 'paper', confidence: 0.7}],
  textures: [{type: 'paper', density: 0.2, tactileContrast: 0.3, confidence: 0.7}],
  geometry: {organicGeometricBalance: 0.8, angularity: 0.7, curvature: 0.2, repetition: 0.5, modularity: 0.8, shapeLanguage: ['rectilinear'], silhouettes: [], contourBehavior: ['hard-edged']},
  depth: {occlusion: 0.1, atmosphericPerspective: 0, blurHierarchy: 0, spatialLayering: 0.2, ambientOcclusion: 0},
  gestalt: {principles: [{principle: 'proximity', strength: 0.8, evidence: []}]},
  brandLanguage: {personality: ['restrained'], perceivedPriceLevel: 0.7, sophistication: 0.8, accessibility: 0.6, innovation: 0.5, trust: 0.8, energy: 0.3, restraint: 0.9, distinctiveness: 0.7},
  visualMovementInfluence: [{movementId: 'swiss', strength: 0.7, matchedPrincipleIds: ['swiss.grid-discipline'], evidence: [], confidence: 0.8}],
  antiAiAssessment,
  semanticExclusions: createSemanticExclusions(),
  evidence: createEvidenceCollection(),
  metrics: {hierarchyClarity: {value: 0.9, confidence: 0.8}},
  confidence: 0.8,
};

export const runDesignDNAValidationChecks = (): void => {
  const minimal = createMinimalDesignDNA();
  assert(validateDesignDNA(minimal).success, 'minimal object should be valid');
  const completeResult = validateDesignDNA(completeDesignDNA);
  assert(completeResult.success, `complete object should be valid${completeResult.success === false ? ` (${completeResult.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')})` : ''}`);
  assert(!validateDesignDNA({...minimal, confidence: 1.01}).success, 'values outside 0–1 should be rejected');
  assert(!validateDesignDNA({...minimal, evidence: {...minimal.evidence, observedFacts: [{observation: 'Invalid box', confidence: 1, inferenceLevel: 'observed', region: {x: 0.8, y: 0, width: 0.3, height: 0.2}}]}}).success, 'invalid bounding boxes should be rejected');
  assert(!validateDesignDNA({...minimal, confidence: -0.1}).success, 'invalid confidence should be rejected');
  assert(!validateDesignDNA({...minimal, evidence: {...minimal.evidence, observedFacts: [{observation: 'Invalid level', confidence: 1, inferenceLevel: 'invalid'}]}}).success, 'invalid inference levels should be rejected');
  assert(validateAntiAIAssessment(antiAiAssessment).length === 0, 'valid Anti-AI assessment should pass');
  assert(validateSemanticExclusions(createSemanticExclusions()).length === 0, 'valid SemanticExclusions should pass');
  assert(!validateDesignDNA({...minimal, schemaVersion: undefined}).success, 'schemaVersion should be required');
  assert(validateDesignDNA({...minimal, confidence: 0}).success, 'valid normalized boundary should pass');
};

runDesignDNAValidationChecks();
