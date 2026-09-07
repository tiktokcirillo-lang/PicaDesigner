import type {AIUsageResult} from '../../infrastructure/ai/types.js';
import type {ReferenceIntelligenceSession} from '../reference-intelligence/index.js';
import type {AdaptedDesignConstraints, BrandInput, BrandIntelligenceSession, BrandReferenceCompatibilityReport} from '../../domain/brand-intelligence/index.js';
import type {CreativeDirectionSession} from '../../domain/creative-direction/index.js';
import type {LayoutIntelligenceSession} from '../../domain/layout-engine/index.js';

export interface GenerateDesignSpecRequest {
  projectId: string;
  copy: string;
  format: string;
  destinationTool: string;
  tone: string;
  brandInput?: BrandInput;
  brandIntelligence?: BrandIntelligenceSession;
  referenceIntelligence?: ReferenceIntelligenceSession;
  adaptedDesignConstraints?: AdaptedDesignConstraints;
  creativeDirection?: CreativeDirectionSession;
  layoutIntelligence?: LayoutIntelligenceSession;
  /** @deprecated Temporary compatibility for pre-3.4 clients. */
  legacyPrompt?: string;
}
export interface DesignDecision {decision: string; domain: string; source: 'communication_strategy' | 'reference_structure' | 'brand_hard_constraint' | 'brand_soft_preference' | 'brand_distinctive_asset' | 'adaptation' | 'creative_concept' | 'creative_device' | 'format' | 'execution_interpretation'; confidence?: number}
export interface DesignSpecificationResult {
  content: string;
  projectId: string;
  referenceSessionId?: string;
  brandIntelligence?: BrandIntelligenceSession;
  brandCompatibility?: BrandReferenceCompatibilityReport;
  adaptedDesignConstraints?: AdaptedDesignConstraints;
  layoutIntelligence?: LayoutIntelligenceSession;
  qualityMetadata?: {referenceQualityScore?: number; referenceConfidence?: number; decisionProvenance: DesignDecision[]};
  aiUsage: AIUsageResult;
  stageCostUsd: number;
}
