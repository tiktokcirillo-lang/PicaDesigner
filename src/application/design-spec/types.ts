import type {AIUsageResult} from '../../infrastructure/ai/types.js';
import type {ReferenceIntelligenceSession} from '../reference-intelligence/index.js';

export interface BrandInput {colors?: string[]; headlineFont?: string; bodyFont?: string; lineHeight?: string; letterSpacing?: string; wordSpacing?: string; url?: string}
export interface GenerateDesignSpecRequest {
  projectId: string;
  copy: string;
  format: string;
  destinationTool: string;
  tone: string;
  brandInput?: BrandInput;
  referenceIntelligence?: ReferenceIntelligenceSession;
  /** @deprecated Temporary compatibility for pre-3.4 clients. */
  legacyPrompt?: string;
}
export interface DesignDecision {decision: string; domain: string; source: 'reference_dna' | 'brand' | 'communication' | 'format' | 'creative_interpretation'; confidence?: number}
export interface DesignSpecificationResult {
  content: string;
  projectId: string;
  referenceSessionId?: string;
  qualityMetadata?: {referenceQualityScore?: number; referenceConfidence?: number; decisionProvenance: DesignDecision[]};
  aiUsage: AIUsageResult;
}
