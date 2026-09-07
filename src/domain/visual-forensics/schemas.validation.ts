import {createSemanticExclusions, validateDesignDNA, type VisualEvidence} from '../art-direction';
import {propagateConfidence} from './confidence';
import {mapForensicsToDesignDNA} from './mapper';
import {createMinimalVisualForensicsReport, validateVisualForensicsReport} from './schemas';
import type {ConfidentFeature, VisualForensicsReport} from './types';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Visual Forensics validation failed: ${message}`);
};
const feature = <T>(value: T, confidence = 0.8): ConfidentFeature<T> => ({value, confidence, evidenceIds: ['obs-1']});
const evidence: VisualEvidence = {observation: 'Two regions share a left edge.', confidence: 0.9, inferenceLevel: 'observed'};
const exclusions = createSemanticExclusions();
exclusions.literalBrands = {exclude: true, reason: 'Preserve structure without brand identity.'};

const completeReport: VisualForensicsReport = {
  ...createMinimalVisualForensicsReport({id: 'report-1', sourceId: 'reference-1', analysisDepth: 'forensic'}, exclusions),
  canvas: {width: 1200, height: 1500, aspectRatio: 0.8, orientation: 'portrait', estimatedSafeArea: {x: 0.05, y: 0.05, width: 0.9, height: 0.9}, visualCenter: {x: 0.5, y: 0.5}, opticalCenter: {point: {x: 0.56, y: 0.47}, confidence: 0.8, evidenceIds: ['obs-1']}},
  observations: [
    {id: 'obs-1', domain: 'composition', observation: 'A large high-contrast region occupies the center-right.', region: {x: 0.45, y: 0.15, width: 0.45, height: 0.55}, confidence: 0.9, inferenceLevel: 'observed', measurement: {kind: 'areaRatio', value: 0.2475, unit: 'normalized', confidence: 0.9, method: 'estimated'}, relatedRegionIds: ['region-hero']},
    {id: 'obs-2', domain: 'relationships', observation: 'A smaller text region aligns with the large region.', confidence: 0.85, inferenceLevel: 'observed', relatedRegionIds: ['region-hero', 'region-text']},
  ],
  regions: [
    {id: 'region-hero', type: 'graphic', boundingBox: {x: 0.45, y: 0.15, width: 0.45, height: 0.55}, areaRatio: 0.2475, centroid: {x: 0.675, y: 0.425}, visualWeight: 0.9, salience: 0.92, edgeProximity: {top: 0.15, right: 0.1, bottom: 0.3, left: 0.45}, contrastAgainstEnvironment: 0.85, confidence: 0.9, evidenceIds: ['obs-1']},
    {id: 'region-text', type: 'text', boundingBox: {x: 0.1, y: 0.2, width: 0.25, height: 0.2}, areaRatio: 0.05, centroid: {x: 0.225, y: 0.3}, visualWeight: 0.65, salience: 0.7, edgeProximity: {top: 0.2, right: 0.65, bottom: 0.6, left: 0.1}, contrastAgainstEnvironment: 0.75, confidence: 0.88, evidenceIds: ['obs-2']},
  ],
  relationships: [{id: 'rel-1', sourceRegionId: 'region-text', targetRegionId: 'region-hero', relationship: 'alignment', strength: 0.8, evidenceIds: ['obs-2'], evidence: [evidence], confidence: 0.85, measurement: {kind: 'alignmentDeviation', value: 0.03, unit: 'normalized', confidence: 0.8}}],
  compositionAnalysis: {symmetryScore: 0.3, asymmetryStrength: 0.75, balance: 'asymmetric', balanceConfidence: 0.85, visualCenterOfGravity: {x: 0.56, y: 0.47}, visualMassDistribution: {topLeft: 0.2, topCenter: 0.15, topRight: 0.5, middleLeft: 0.3, center: 0.6, middleRight: 0.9, bottomLeft: 0.15, bottomCenter: 0.2, bottomRight: 0.35}, directionalFlow: ['right', 'down'], edgeTension: {top: 0.3, right: 0.65, bottom: 0.2, left: 0.25}, framing: ['negative space frames the text region'], cropping: 'intentional', overlapStrength: 0.2, layeringStrength: 0.45, focalRegionIds: ['region-hero'], evidenceIds: ['obs-1', 'obs-2']},
  hierarchyAnalysis: {primaryFocus: {regionId: 'region-hero', level: 'primary', factors: [{factor: 'scale', contribution: 0.92, confidence: 0.9, evidenceIds: ['obs-1']}, {factor: 'contrast', contribution: 0.85, confidence: 0.85, evidenceIds: ['obs-1']}], score: 0.91, confidence: 0.88, explanation: 'Scale and contrast create primary dominance.'}, secondaryFocus: [{regionId: 'region-text', level: 'secondary', factors: [{factor: 'isolation', contribution: 0.7, confidence: 0.8, evidenceIds: ['obs-2']}], score: 0.7, confidence: 0.8, explanation: 'Isolation supports secondary attention.'}], tertiaryFocus: [], readingFlow: {entryPoint: 'region-hero', attentionSequence: ['region-hero', 'region-text'], transitions: [{fromRegionId: 'region-hero', toRegionId: 'region-text', strength: 0.75, evidenceIds: ['obs-2']}], exitPoint: 'region-text', readingPattern: 'custom', confidence: 0.8, evidenceIds: ['obs-1', 'obs-2']}, clarity: 0.85, evidenceIds: ['obs-1', 'obs-2']},
  spacingAnalysis: {negativeSpace: {negativeSpaceRatio: 0.48, distribution: 'left_heavy', activeRatio: 0.35, passiveRatio: 0.13, purposePotential: 0.8, balanceContribution: 0.75, textPlacementPotential: 0.7, breathingRoom: 0.78, edgePressure: {top: 0.2, right: 0.55, bottom: 0.15, left: 0.2}, confidence: 0.82, evidenceIds: ['obs-1']}, alignmentRhythm: 0.8, spacingConsistency: 0.76, density: 0.52, evidenceIds: ['obs-1', 'obs-2']},
  typographyAnalysis: {regions: [{regionId: 'region-text', classification: feature('sans_serif'), estimatedWeight: feature(700), estimatedWidth: feature('normal'), caseBehavior: feature('uppercase'), trackingCharacter: feature('wide'), leadingCharacter: feature('normal'), lineLength: feature(16), numberOfLines: feature(3), alignment: feature('left'), textBlockDensity: 0.55, scaleRelationship: 0.65, headlineBehavior: ['stacked lines'], hierarchyRole: feature('headline'), confidence: 0.83}], contrastStrength: 0.76, hierarchyOrder: ['region-text'], evidenceIds: ['obs-2']},
  colorAnalysis: {samples: [{id: 'color-red', hex: '#D9232E', estimatedCoverage: 0.25, relativeLuminance: 0.2, saturation: 0.85, temperature: 'warm', confidence: 0.88, evidenceIds: ['obs-1']}, {id: 'color-white', hex: '#F5F5F2', estimatedCoverage: 0.65, relativeLuminance: 0.91, saturation: 0.04, temperature: 'neutral', confidence: 0.9, evidenceIds: ['obs-1']}], functions: [{sampleId: 'color-red', function: 'focal_dominance', explanation: 'High saturation concentrates attention.', confidence: 0.84, evidenceIds: ['obs-1']}], contrastRelationships: [{sourceSampleId: 'color-red', targetSampleId: 'color-white', strength: 0.82, kind: 'mixed', confidence: 0.85}], backgroundForegroundContrast: 0.84, distribution: [{regionId: 'region-hero', sampleIds: ['color-red'], coverage: 0.8}], evidenceIds: ['obs-1']},
  lightingAnalysis: {lightDirection: feature('down'), keyLightEstimate: feature('Large diffuse source likely above.'), fillBehavior: feature('balanced'), rimPresence: feature(false), shadowDirection: feature('down'), shadowHardness: feature(0.25), diffusion: feature(0.8), specularBehavior: feature('Broad restrained highlights.'), ambientIllumination: feature(0.55), contrastRatioEstimate: feature(2.5), lightTemperature: feature('neutral'), multipleLightSources: feature(false), uncertainty: ['Source size cannot be measured exactly.'], evidenceIds: ['obs-1'], confidence: 0.76},
  depthAnalysis: {foregroundRegionIds: ['region-text'], midgroundRegionIds: ['region-hero'], backgroundRegionIds: [], occlusionRelationshipIds: [], depthCues: [{cue: 'scale', sourceRegionId: 'region-hero', targetRegionId: 'region-text', strength: 0.55, confidence: 0.72, evidenceIds: ['obs-1']}], focusHierarchy: ['region-hero', 'region-text'], blurHierarchy: [], relativeDepth: [{regionId: 'region-text', depth: 0.2, confidence: 0.65}, {regionId: 'region-hero', depth: 0.45, confidence: 0.65}], strength: 0.4, evidenceIds: ['obs-1']},
  materialAnalysis: [{regionId: 'region-hero', roughness: feature(0.3), glossiness: feature(0.7), specularStrength: feature(0.65), translucency: feature(0), transparency: feature(0), reflectivity: feature(0.55), surfaceUniformity: feature(0.75), microTexture: feature(0.2), edgeBehavior: feature('hard clean edge'), likelyMaterial: feature('plastic', 0.62), evidenceIds: ['obs-1'], confidence: 0.7}],
  semanticContent: {semanticObservations: [{id: 'semantic-brand', category: 'brand', description: 'The written brand name Acme is visible.', confidence: 0.95, relatedRegionIds: ['region-text']}], excludedObservationIds: ['semantic-brand'], policy: exclusions},
  semanticExclusions: exclusions,
  inferredPrinciples: [{principleId: 'swiss.grid-discipline', evidenceIds: ['obs-1', 'obs-2'], confidence: 0.78, explanation: 'Column alignment and controlled asymmetry support grid discipline.'}],
  antiAiFindings: [{signal: 'overSymmetry', mappedKnowledgeSignalId: 'unjustified_perfect_symmetry', evidenceIds: ['obs-1'], confidence: 0.35, severity: 0.15, explanation: 'Low risk; the mass distribution is visibly asymmetric.'}],
  uncertainties: [{id: 'uncertainty-1', domain: 'lighting', description: 'Exact number of light sources is uncertain.', reason: 'lighting_ambiguity', confidence: 0.45, impact: 'low', evidenceIds: ['obs-1']}],
  contradictions: [{id: 'contradiction-1', statements: ['Geometric layout is centered.', 'Visual mass is right-heavy.'], evidenceIds: ['obs-1'], severity: 0.35, resolutionStatus: 'accepted_ambiguity', resolution: 'Geometric centering and optical imbalance describe different properties.'}],
  evidenceQuality: {coverage: 0.82, consistency: 0.86, measurementSupport: 0.65, observationToInferenceRatio: 0.75, speculationRisk: 0.18, overall: 0.79},
  overallConfidence: 0.81,
};

export const runVisualForensicsValidationChecks = (): void => {
  const minimal = createMinimalVisualForensicsReport();
  assert(validateVisualForensicsReport(minimal).success, 'minimal report should be valid');
  const complete = validateVisualForensicsReport(completeReport);
  assert(complete.success, `complete report should be valid${complete.success === false ? `: ${complete.issues.map(({path, message}) => `${path} ${message}`).join('; ')}` : ''}`);
  assert(!validateVisualForensicsReport({...completeReport, canvas: {...completeReport.canvas, visualCenter: {x: 1.2, y: 0.5}}}).success, 'invalid normalized coordinates should fail');
  assert(!validateVisualForensicsReport({...completeReport, regions: [{...completeReport.regions[0], areaRatio: 1.2}]}).success, 'invalid visual region should fail');
  assert(!validateVisualForensicsReport({...completeReport, relationships: [{...completeReport.relationships[0], targetRegionId: 'missing'}]}).success, 'malformed relationship reference should fail');
  assert(!validateVisualForensicsReport({...completeReport, overallConfidence: 1.1}).success, 'confidence above 1 should fail');
  assert(completeReport.relationships[0].evidenceIds.every((id) => completeReport.observations.some((item) => item.id === id)), 'evidence chain should be valid');
  assert(completeReport.contradictions.length === 1 && completeReport.uncertainties.length === 1, 'contradiction and uncertainty fixtures should be valid');
  assert(completeReport.semanticContent.excludedObservationIds.includes('semantic-brand'), 'semantic firewall should track excluded semantic content');
  const propagated = propagateConfidence([{confidence: 0.9}, {confidence: 0.6}], 0.8);
  assert(Math.abs(propagated - 0.6) < 0.000001 && propagated <= 0.9, 'confidence propagation should be conservative');
  const dna = mapForensicsToDesignDNA(completeReport);
  const dnaResult = validateDesignDNA(dna);
  assert(dnaResult.success, `Forensics to DesignDNA mapping should be valid${dnaResult.success === false ? `: ${dnaResult.issues.map(({path, message}) => `${path} ${message}`).join('; ')}` : ''}`);
  assert(!dna.evidence.observedFacts.some(({observation}) => observation.includes('Acme')), 'semantic exclusion should be respected during mapping');
};

runVisualForensicsValidationChecks();
