import {
  VISUAL_MOVEMENTS,
  createMinimalDesignDNA,
  findAntiAISignal,
  type AntiAISignalAssessment,
  type DesignDNA,
  type Direction,
  type FocalPoint,
  type MaterialObservation,
  type VisualEvidence,
  type VisualMovementInfluence,
} from '../art-direction/index.js';
import {propagateConfidence} from './confidence.js';
import type {HierarchyFocus, RawVisualObservation, VisualForensicsReport} from './types.js';

const toEvidence = (observation: RawVisualObservation): VisualEvidence => ({
  observation: observation.observation,
  ...(observation.region ? {region: observation.region} : {}),
  confidence: observation.confidence,
  inferenceLevel: 'observed',
});

const evidenceFor = (report: VisualForensicsReport, ids: readonly string[]): VisualEvidence[] => {
  const wanted = new Set(ids);
  return report.observations.filter(({id}) => wanted.has(id)).map(toEvidence);
};

const focalPoint = (report: VisualForensicsReport, focus: HierarchyFocus): FocalPoint => {
  const region = report.regions.find(({id}) => id === focus.regionId);
  return {
    description: `Structural focus region ${focus.regionId}`,
    ...(region ? {boundingBox: region.boundingBox} : {}),
    visualWeight: focus.score,
    confidence: Math.min(focus.confidence, report.overallConfidence),
    evidence: evidenceFor(report, focus.factors.flatMap(({evidenceIds}) => evidenceIds)),
  };
};

const MATERIALS = new Set<MaterialObservation['material']>(['matte', 'gloss', 'satin', 'metallic', 'translucent', 'transparent', 'rough', 'polished', 'paper', 'plastic', 'glass', 'chrome', 'textile', 'natural', 'unknown']);

const mapMovements = (report: VisualForensicsReport): VisualMovementInfluence[] => VISUAL_MOVEMENTS.flatMap((movement) => {
  const principles = report.inferredPrinciples.filter(({principleId}) => movement.principleIds.includes(principleId));
  if (!principles.length) return [];
  const evidenceIds = [...new Set(principles.flatMap(({evidenceIds}) => evidenceIds))];
  return [{movementId: movement.id, strength: propagateConfidence(principles.map(({confidence}) => ({confidence}))), matchedPrincipleIds: principles.map(({principleId}) => principleId), evidence: evidenceFor(report, evidenceIds), confidence: propagateConfidence(principles.map(({confidence}) => ({confidence})), report.evidenceQuality.coverage)}];
});

export const mapForensicsToDesignDNA = (report: VisualForensicsReport): DesignDNA => {
  const dna = createMinimalDesignDNA({id: report.metadata.id, sourceId: report.metadata.sourceId, createdAt: report.metadata.createdAt, extractor: report.metadata.extractor});
  dna.sourceAnalysis = {sourceType: 'image', width: report.canvas.width, height: report.canvas.height, aspectRatio: report.canvas.aspectRatio};
  dna.semanticExclusions = report.semanticExclusions;
  dna.evidence.observedFacts = report.observations.map(toEvidence);
  dna.evidence.inferredProperties = report.inferredPrinciples.map((principle) => ({observation: principle.explanation, confidence: Math.min(principle.confidence, report.overallConfidence), inferenceLevel: 'strongly_inferred'}));
  dna.evidence.uncertainProperties = report.uncertainties.map((uncertainty) => ({observation: `${uncertainty.description} (${uncertainty.reason})`, confidence: uncertainty.confidence, inferenceLevel: 'speculative'}));
  dna.confidence = propagateConfidence([{confidence: report.overallConfidence}, {confidence: report.evidenceQuality.overall}], report.evidenceQuality.consistency);

  const composition = report.compositionAnalysis;
  if (composition) dna.composition = {
    balance: {value: composition.balance, confidence: Math.min(composition.balanceConfidence, report.overallConfidence), evidence: evidenceFor(report, composition.evidenceIds)},
    centerOfGravity: {value: composition.visualCenterOfGravity, confidence: Math.min(report.canvas.opticalCenter.confidence, report.overallConfidence), evidence: evidenceFor(report, report.canvas.opticalCenter.evidenceIds)},
    directionalFlow: {value: composition.directionalFlow, confidence: Math.min(report.overallConfidence, report.evidenceQuality.overall), evidence: evidenceFor(report, composition.evidenceIds)},
    focalPlacement: composition.focalRegionIds.flatMap((id) => {
      const region = report.regions.find((item) => item.id === id);
      return region ? [{description: `Focal region ${id}`, boundingBox: region.boundingBox, visualWeight: region.visualWeight, confidence: Math.min(region.confidence, report.overallConfidence)}] : [];
    }),
    edgeTension: {value: composition.edgeTension, confidence: Math.min(report.overallConfidence, report.evidenceQuality.coverage), evidence: evidenceFor(report, composition.evidenceIds)},
    ...(composition.cropping !== 'uncertain' ? {cropping: {value: composition.cropping, confidence: report.overallConfidence, evidence: evidenceFor(report, composition.evidenceIds)}} : {}),
    framing: composition.framing,
    layering: {value: composition.layeringStrength, confidence: report.overallConfidence, evidence: evidenceFor(report, composition.evidenceIds)},
    overlap: {value: composition.overlapStrength, confidence: report.overallConfidence, evidence: evidenceFor(report, composition.evidenceIds)},
  };

  const hierarchy = report.hierarchyAnalysis;
  if (hierarchy) dna.visualHierarchy = {
    ...(hierarchy.primaryFocus ? {primaryFocus: focalPoint(report, hierarchy.primaryFocus)} : {}),
    secondaryFocus: hierarchy.secondaryFocus.map((focus) => focalPoint(report, focus)),
    tertiaryFocus: hierarchy.tertiaryFocus.map((focus) => focalPoint(report, focus)),
    readingOrder: hierarchy.readingFlow.attentionSequence.flatMap((regionId) => {
      const focus = [hierarchy.primaryFocus, ...hierarchy.secondaryFocus, ...hierarchy.tertiaryFocus].find((item) => item?.regionId === regionId);
      return focus ? [focalPoint(report, focus)] : [];
    }),
    attentionAnchors: [hierarchy.primaryFocus, ...hierarchy.secondaryFocus].filter((item): item is HierarchyFocus => Boolean(item)).map((focus) => focalPoint(report, focus)),
  };

  if (report.spacingAnalysis) dna.spacing = {
    negativeSpaceRatio: report.spacingAnalysis.negativeSpace.negativeSpaceRatio,
    activeSpaceRatio: report.spacingAnalysis.negativeSpace.activeRatio,
    passiveSpaceRatio: report.spacingAnalysis.negativeSpace.passiveRatio,
    density: report.spacingAnalysis.density,
  };

  if (report.typographyAnalysis) dna.typography = {
    samples: report.typographyAnalysis.regions.map((sample) => ({
      role: sample.hierarchyRole.value,
      classification: sample.classification.value,
      personality: [],
      weight: sample.estimatedWeight.value,
      width: sample.estimatedWidth.value,
      tracking: sample.trackingCharacter.value === 'unknown' ? undefined : sample.trackingCharacter.value,
      case: sample.caseBehavior.value === 'unknown' ? undefined : sample.caseBehavior.value,
      alignment: sample.alignment.value,
      boundingBox: report.regions.find(({id}) => id === sample.regionId)?.boundingBox,
      confidence: Math.min(sample.confidence, report.overallConfidence),
    })),
    hierarchy: report.typographyAnalysis.hierarchyOrder,
    textDensity: report.typographyAnalysis.regions.length ? report.typographyAnalysis.regions.reduce((sum, item) => sum + item.textBlockDensity, 0) / report.typographyAnalysis.regions.length : 0,
    typographicContrast: report.typographyAnalysis.contrastStrength,
  };

  if (report.colorAnalysis) dna.color = {
    palette: report.colorAnalysis.samples.map((sample) => ({hex: sample.hex, role: report.colorAnalysis?.functions.find(({sampleId}) => sampleId === sample.id)?.function === 'accent' ? 'accent' : 'supporting', coverage: sample.estimatedCoverage, luminance: sample.relativeLuminance, saturation: sample.saturation, temperature: sample.temperature, confidence: Math.min(sample.confidence, report.overallConfidence)})),
    hueRelationship: 'unknown',
    contrast: report.colorAnalysis.backgroundForegroundContrast,
    foregroundBackgroundSeparation: report.colorAnalysis.backgroundForegroundContrast,
    tonalHierarchy: [],
    brandDominance: 0,
  };

  if (report.lightingAnalysis) dna.lighting = {
    shadowHardness: report.lightingAnalysis.shadowHardness.value,
    shadowDirection: report.lightingAnalysis.shadowDirection?.value,
    diffusion: report.lightingAnalysis.diffusion.value,
    ambientIllumination: report.lightingAnalysis.ambientIllumination.value,
    colorTemperature: report.lightingAnalysis.lightTemperature.value,
    contrastRatio: report.lightingAnalysis.contrastRatioEstimate?.value,
    confidence: Math.min(report.lightingAnalysis.confidence, report.overallConfidence),
  };

  if (report.depthAnalysis) dna.depth = {occlusion: report.depthAnalysis.depthCues.filter(({cue}) => cue === 'occlusion').reduce((max, cue) => Math.max(max, cue.strength), 0), atmosphericPerspective: report.depthAnalysis.depthCues.filter(({cue}) => cue === 'atmospheric_perspective').reduce((max, cue) => Math.max(max, cue.strength), 0), blurHierarchy: report.depthAnalysis.depthCues.filter(({cue}) => cue === 'blur').reduce((max, cue) => Math.max(max, cue.strength), 0), spatialLayering: report.depthAnalysis.strength, ambientOcclusion: 0};

  if (report.materialAnalysis) dna.materials = report.materialAnalysis.flatMap((material) => {
    const likely = material.likelyMaterial?.value;
    if (!likely || !MATERIALS.has(likely as MaterialObservation['material'])) return [];
    const region = report.regions.find(({id}) => id === material.regionId);
    return [{material: likely as MaterialObservation['material'], region: region?.boundingBox, confidence: Math.min(material.likelyMaterial?.confidence ?? 0, material.confidence, report.overallConfidence)}];
  });

  const movementInfluence = mapMovements(report);
  if (movementInfluence.length) dna.visualMovementInfluence = movementInfluence;
  if (report.antiAiFindings.length) {
    const signals: AntiAISignalAssessment[] = report.antiAiFindings.map((finding) => ({signalId: finding.mappedKnowledgeSignalId, severity: finding.severity, confidence: Math.min(finding.confidence, report.overallConfidence), reason: finding.explanation, suggestedCorrection: findAntiAISignal(finding.mappedKnowledgeSignalId)?.defaultCorrection ?? 'Review the finding against the Art Direction Anti-AI knowledge base.', evidence: evidenceFor(report, finding.evidenceIds)}));
    dna.antiAiAssessment = {signals, positivePrinciples: [], overallRisk: Math.max(...signals.map(({severity}) => severity)), confidence: propagateConfidence(signals.map(({confidence}) => ({confidence})), report.evidenceQuality.coverage)};
  }
  dna.metrics = {
    ...(report.spacingAnalysis ? {negativeSpaceRatio: {value: report.spacingAnalysis.negativeSpace.negativeSpaceRatio, confidence: report.spacingAnalysis.negativeSpace.confidence, evidence: evidenceFor(report, report.spacingAnalysis.negativeSpace.evidenceIds)}, visualDensity: {value: report.spacingAnalysis.density, confidence: report.overallConfidence}} : {}),
    ...(composition ? {symmetryScore: {value: composition.symmetryScore, confidence: composition.balanceConfidence, evidence: evidenceFor(report, composition.evidenceIds)}, compositionTension: {value: Math.max(...Object.values(composition.edgeTension)), confidence: report.overallConfidence}} : {}),
    ...(hierarchy ? {hierarchyClarity: {value: hierarchy.clarity, confidence: report.overallConfidence, evidence: evidenceFor(report, hierarchy.evidenceIds)}} : {}),
    ...(report.typographyAnalysis ? {typographicContrast: {value: report.typographyAnalysis.contrastStrength, confidence: report.overallConfidence}} : {}),
    ...(report.colorAnalysis ? {colorContrastStrength: {value: report.colorAnalysis.backgroundForegroundContrast, confidence: report.overallConfidence}} : {}),
    ...(report.depthAnalysis ? {depthStrength: {value: report.depthAnalysis.strength, confidence: report.overallConfidence}} : {}),
    ...(report.antiAiFindings.length ? {aiArtifactRisk: {value: Math.max(...report.antiAiFindings.map(({severity}) => severity)), confidence: dna.antiAiAssessment?.confidence ?? report.overallConfidence}} : {}),
  };
  return dna;
};
