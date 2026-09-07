import type {DesignDNA} from '../../domain/art-direction/index.js';
import type {VisualForensicsReport} from '../../domain/visual-forensics/index.js';

export interface QualityDimensions {evidenceIntegrity: number; compositionReasoning: number; hierarchyReasoning: number; typographicReasoning: number; colorReasoning: number; physicalPlausibility: number; semanticSeparation: number; antiAiDetection: number; confidenceCalibration: number}
export interface QualityProfile {score: number; dimensions: QualityDimensions; issues: string[]; requiresCritic: boolean}
export interface SolCriticResult {criticScore: number; dimensions: QualityDimensions; issues: string[]; corrections: string[]; requiresRevision: boolean; confidence: number}

const pct = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);
export const detectSemanticLeakage = (report: VisualForensicsReport, dna: DesignDNA): string[] => {
  const excluded = new Set(report.semanticContent.excludedObservationIds);
  const structuralText = [...dna.evidence.observedFacts, ...dna.evidence.inferredProperties].map(({observation}) => observation.toLowerCase());
  return report.semanticContent.semanticObservations.filter(({id, description}) => excluded.has(id) && structuralText.some((text) => text.includes(description.toLowerCase()))).map(({id}) => id);
};
export const evaluateForensicsQuality = (report: VisualForensicsReport, dna: DesignDNA): QualityProfile => {
  const contradictionPenalty = Math.max(0, ...report.contradictions.map(({severity}) => severity));
  const dimensions: QualityDimensions = {
    evidenceIntegrity: pct(report.evidenceQuality.overall),
    compositionReasoning: report.compositionAnalysis ? pct(report.compositionAnalysis.balanceConfidence) : 45,
    hierarchyReasoning: report.hierarchyAnalysis ? pct(report.hierarchyAnalysis.clarity) : 45,
    typographicReasoning: report.typographyAnalysis ? pct(report.overallConfidence) : 75,
    colorReasoning: report.colorAnalysis ? pct(report.overallConfidence) : 75,
    physicalPlausibility: report.lightingAnalysis || report.materialAnalysis?.length ? pct(1 - report.evidenceQuality.speculationRisk) : 75,
    semanticSeparation: detectSemanticLeakage(report, dna).length === 0 ? 100 : 0,
    antiAiDetection: report.antiAiFindings.length || report.evidenceQuality.speculationRisk < 0.2 ? 85 : 65,
    confidenceCalibration: pct(Math.min(report.overallConfidence, report.evidenceQuality.overall) * (1 - contradictionPenalty * 0.5)),
  };
  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0) / Object.keys(dimensions).length;
  const issues = [report.evidenceQuality.overall < 0.75 ? 'Evidence quality is below 0.75.' : '', report.evidenceQuality.speculationRisk > 0.3 ? 'Speculation risk exceeds 0.30.' : '', report.overallConfidence < 0.75 ? 'Overall confidence is below 0.75.' : '', contradictionPenalty >= 0.5 ? 'A relevant contradiction remains.' : ''].filter(Boolean);
  return {score, dimensions, issues, requiresCritic: score < 85 || issues.length > 0};
};

export const shouldEscalateToSol = (report: VisualForensicsReport, quality: QualityProfile): {escalate: boolean; reasons: string[]} => {
  const reasons = [...quality.issues];
  if (quality.score < 85) reasons.push(`Quality score ${quality.score.toFixed(1)} is below 85.`);
  if (report.antiAiFindings.some(({severity, confidence}) => severity >= 0.5 && confidence < 0.75)) reasons.push('Important Anti-AI ambiguity requires audit.');
  return {escalate: quality.requiresCritic || reasons.length > 0, reasons: [...new Set(reasons)]};
};
