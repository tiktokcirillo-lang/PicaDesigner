import type {AIUsageResult} from '../../infrastructure/ai/types.js';
import type {ReferenceIntelligenceSession} from '../reference-intelligence/index.js';
import type {AdaptedDesignConstraints, BrandInput, BrandIntelligenceSession, BrandReferenceCompatibilityReport} from '../../domain/brand-intelligence/index.js';

export interface GenerateDesignSpecRequest {
  projectId: string;
  copy: string;
  format: string;
  destinationTool: string;
  tone: string;
  brandInput?: BrandInput;
  brandIntelligence?: BrandIntelligenceSession;
  referenceIntelligence?: ReferenceIntelligenceSession;
  /** @deprecated Temporary compatibility for pre-3.4 clients. */
  legacyPrompt?: string;
}
export interface DesignDecision {decision: string; domain: string; source: 'brand_hard_constraint' | 'brand_soft_preference' | 'reference_structure' | 'communication' | 'format' | 'adaptation' | 'creative_interpretation'; confidence?: number}
export interface DesignSpecificationResult {
  content: string;
  projectId: string;
  referenceSessionId?: string;
  brandIntelligence?: BrandIntelligenceSession;
  brandCompatibility?: BrandReferenceCompatibilityReport;
  adaptedDesignConstraints?: AdaptedDesignConstraints;
  qualityMetadata?: {referenceQualityScore?: number; referenceConfidence?: number; decisionProvenance: DesignDecision[]};
  aiUsage: AIUsageResult;
}
