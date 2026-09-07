import type {DesignDNA, SemanticExclusions} from '../../domain/art-direction/index.js';
import type {AIUsageResult} from '../../infrastructure/ai/types.js';
import type {AnalysisDepth, VisualForensicsReport, VisualInput} from '../../domain/visual-forensics/index.js';
import type {QualityProfile} from '../visual-intelligence/quality.js';

export const REFERENCE_INTELLIGENCE_SCHEMA_VERSION = '1.0.0' as const;
export const MINIMUM_REFERENCE_QUALITY = {evidenceQuality: 0.60, overallConfidence: 0.60} as const;

export interface ReferenceSourceMetadata {mediaType: string; width?: number; height?: number; aspectRatio?: number; fileName?: string; fileSize?: number; lastModified?: number; imageFingerprint?: string}
export type ReferenceIntelligenceStatus = 'idle' | 'analyzing' | 'ready' | 'partial' | 'failed';
export interface ReferenceIntelligenceSession {
  schemaVersion: typeof REFERENCE_INTELLIGENCE_SCHEMA_VERSION;
  sessionId: string;
  projectId: string;
  createdAt: string;
  source: ReferenceSourceMetadata;
  analysisDepth: AnalysisDepth;
  status: ReferenceIntelligenceStatus;
  forensicsSchemaVersion: string;
  designDNASchemaVersion: string;
  forensics?: VisualForensicsReport;
  designDNA?: DesignDNA;
  quality?: QualityProfile;
  aiUsage?: AIUsageResult;
  warnings: string[];
}

export interface CreateReferenceIntelligenceRequest {
  projectId: string;
  image: VisualInput;
  imageMetadata?: Omit<ReferenceSourceMetadata, 'mediaType'>;
  analysisDepth?: AnalysisDepth;
  semanticExclusions?: Partial<SemanticExclusions>;
  context?: string;
}

export interface ReferenceIntelligenceDependencies {
  analyze: (request: CreateReferenceIntelligenceRequest & {analysisDepth: AnalysisDepth}) => Promise<{forensics: VisualForensicsReport; designDNA: DesignDNA; quality: QualityProfile; aiUsage: AIUsageResult}>;
}
