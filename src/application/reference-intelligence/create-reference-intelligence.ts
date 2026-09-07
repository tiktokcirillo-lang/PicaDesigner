import {DESIGN_DNA_SCHEMA_VERSION, validateDesignDNA} from '../../domain/art-direction/index.js';
import {VISUAL_FORENSICS_SCHEMA_VERSION, validateVisualForensicsReport} from '../../domain/visual-forensics/index.js';
import {MINIMUM_REFERENCE_QUALITY, REFERENCE_INTELLIGENCE_SCHEMA_VERSION, type CreateReferenceIntelligenceRequest, type ReferenceIntelligenceDependencies, type ReferenceIntelligenceSession} from './types.js';

export const isReferenceQualityUsable = (session: ReferenceIntelligenceSession): boolean => Boolean(
  session.forensics
  && session.designDNA
  && session.forensics.evidenceQuality.overall >= MINIMUM_REFERENCE_QUALITY.evidenceQuality
  && session.forensics.overallConfidence >= MINIMUM_REFERENCE_QUALITY.overallConfidence,
);

export const validateReferenceSession = (value: unknown, projectId?: string): value is ReferenceIntelligenceSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as ReferenceIntelligenceSession;
  return session.schemaVersion === REFERENCE_INTELLIGENCE_SCHEMA_VERSION
    && session.forensicsSchemaVersion === VISUAL_FORENSICS_SCHEMA_VERSION
    && session.designDNASchemaVersion === DESIGN_DNA_SCHEMA_VERSION
    && (!projectId || session.projectId === projectId)
    && ['idle', 'analyzing', 'ready', 'partial', 'failed'].includes(session.status)
    && Array.isArray(session.warnings)
    && Boolean(session.forensics && validateVisualForensicsReport(session.forensics).success)
    && Boolean(session.designDNA && validateDesignDNA(session.designDNA).success);
};

export const createReferenceIntelligence = async (request: CreateReferenceIntelligenceRequest, dependencies: ReferenceIntelligenceDependencies): Promise<ReferenceIntelligenceSession> => {
  if (request.image.kind === 'url') throw new Error('Remote reference URLs are not supported.');
  const analysisDepth = request.analysisDepth ?? 'standard';
  const result = await dependencies.analyze({...request, analysisDepth});
  const session: ReferenceIntelligenceSession = {
    schemaVersion: REFERENCE_INTELLIGENCE_SCHEMA_VERSION,
    sessionId: crypto.randomUUID(),
    projectId: request.projectId,
    createdAt: new Date().toISOString(),
    source: {mediaType: request.image.mediaType, ...request.imageMetadata},
    analysisDepth,
    status: 'ready',
    forensicsSchemaVersion: result.forensics.schemaVersion,
    designDNASchemaVersion: result.designDNA.schemaVersion,
    forensics: result.forensics,
    designDNA: result.designDNA,
    quality: result.quality,
    aiUsage: result.aiUsage,
    warnings: [],
  };
  if (!isReferenceQualityUsable(session)) {
    session.status = 'partial';
    session.warnings.push('Reference quality is below the minimum threshold for design generation.');
  }
  return session;
};
