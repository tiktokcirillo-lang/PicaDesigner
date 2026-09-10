import type { BrandDNA } from "../brand-intelligence/index.js";
import type { LayoutPlan } from "../layout-engine/index.js";
import type { ApprovedProductionFamily } from "../export-engine/index.js";
export const CAMPAIGN_VARIANT_SCHEMA_VERSION = "1.0.0" as const;
export const CAMPAIGN_VARIANT_POLICY_VERSION = "1.0.0" as const;
export type CampaignVariantStatus =
  | "pending"
  | "planning"
  | "layout_ready"
  | "review_ready"
  | "render_ready"
  | "assets_ready"
  | "qa_pending"
  | "approved"
  | "blocked"
  | "failed"
  | "stale";
export type CampaignFamilyStatus =
  | "draft"
  | "planning"
  | "running"
  | "partial"
  | "approved"
  | "blocked"
  | "failed"
  | "stale";
export interface CampaignInvariantSet {
  selectedCreativeRouteId: string;
  creativeDirectionSessionId: string;
  creativeConcept: string;
  creativeDeviceIdentity: string;
  heroRole: string;
  primaryMessage: string;
  approvedCopyContent: string[];
  ctaContent?: string;
  mandatoryContent: string[];
  brandFingerprint?: string;
  brandDNA?: BrandDNA;
  officialLogoChecksum?: string;
  sourceAssetChecksums: string[];
  campaignVisualIdentity: string;
  majorHierarchyIntent: string;
  fingerprint: string;
}
export interface CampaignVariantLineage {
  creativeDirectionSessionId: string;
  selectedCreativeRouteId: string;
  sourceLayoutId?: string;
  layoutSessionId?: string;
  reviewSessionId?: string;
  renderSessionId?: string;
  imageAssetSessionId?: string;
  postRenderReviewSessionId?: string;
  productionAuthorityId?: string;
  provenance: string[];
}
export interface CampaignVariantReadiness {
  layout: boolean;
  review: boolean;
  render: boolean;
  assets: boolean;
  visualQa: boolean;
  authority: boolean;
  blockers: string[];
}
export interface CampaignVariant {
  variantId: string;
  familyId: string;
  projectId: string;
  formatId: string;
  width: number;
  height: number;
  status: CampaignVariantStatus;
  layoutSessionId?: string;
  reviewSessionId?: string;
  renderSessionId?: string;
  imageAssetSessionId?: string;
  postRenderReviewSessionId?: string;
  productionAuthorityId?: string;
  visualApprovedPackageFingerprint?: string;
  inputFingerprint: string;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  lineage: CampaignVariantLineage;
  readiness: CampaignVariantReadiness;
  layoutPlan?: LayoutPlan;
}
export interface CampaignVariantExecutionPlan {
  familyId: string;
  primaryFormatId: string;
  variantOrder: string[];
  sharedStages: [
    "workspace_input",
    "reference_intelligence",
    "brand_intelligence",
    "creative_direction",
  ];
  variantStages: [
    "layout",
    "art_director_review",
    "render",
    "asset_resolution",
    "visual_qa",
    "production_authority",
  ];
  estimatedCostUsd: number;
  correctionReserveUsd: number;
  withinHardCap: boolean;
}
export type AssetVariantPolicy =
  "shared" | "responsive_crop" | "format_specific";
export interface CampaignAssetPlanItem {
  requirementKey: string;
  variantIds: string[];
  policy: AssetVariantPolicy;
  reuseAssetId?: string;
  generationJobKey?: string;
  cropViable: boolean;
  reason: string;
}
export interface CampaignAssetPlan {
  familyId: string;
  items: CampaignAssetPlanItem[];
  assetDependencies: Record<string, string[]>;
  generationJobs: number;
  reuseRate: number;
}
export interface CampaignVariantDependencyGraph {
  sourceAssets: Record<string, string[]>;
  generatedAssets: Record<string, string[]>;
  generatedAssetLineage?: Array<{
    supersedesAssetId: string;
    replacementAssetId?: string;
    oldChecksum?: string;
    newChecksum?: string;
    affectedVariantIds: string[];
  }>;
  variants: Record<
    string,
    {
      layoutId?: string;
      renderId?: string;
      qaId?: string;
      authorityId?: string;
    }
  >;
}
export interface CampaignFamilyApproval {
  status: "pending" | "partial" | "approved" | "blocked";
  approvedVariantIds: string[];
  missingFormatIds: string[];
  metaAdsPackageReady: boolean;
  familyAuthorityId?: string;
  approvedAt?: string;
}
export interface CampaignFamilyAuthority {
  familyAuthorityId: string;
  familyId: string;
  projectId: string;
  operationId: string;
  fingerprint: string;
  variantAuthorityIds: Record<string, string>;
  status: "valid" | "degraded" | "invalid";
  invariantsFingerprint: string;
  approvedAt: string;
}
export interface CampaignFamilyExportArtifact {
  artifactId: string;
  filename: string;
  format: "zip";
  mediaType: "application/zip";
  byteSize: number;
  checksum: string;
  backingRef: string;
  status: "available" | "unavailable";
}
export interface CampaignFamilyExportSession {
  exportSessionId: string;
  familyId: string;
  familyAuthorityId: string;
  projectId: string;
  operationId: string;
  inputFingerprint: string;
  profile: "meta_ads_package";
  artifact: CampaignFamilyExportArtifact;
  manifest: unknown;
  status: "ready" | "unavailable";
  createdAt: string;
}
export interface CampaignVariantFamily {
  schemaVersion: typeof CAMPAIGN_VARIANT_SCHEMA_VERSION;
  policyVersion: typeof CAMPAIGN_VARIANT_POLICY_VERSION;
  familyId: string;
  projectId: string;
  operationId: string;
  inputFingerprint: string;
  familyDefinitionId: "meta_ads_family";
  primaryFormatId: string;
  status: CampaignFamilyStatus;
  invariants: CampaignInvariantSet;
  variants: CampaignVariant[];
  executionPlan: CampaignVariantExecutionPlan;
  assetPlan?: CampaignAssetPlan;
  dependencyGraph: CampaignVariantDependencyGraph;
  approval: CampaignFamilyApproval;
  familyReview?: CampaignFamilyVisualReview;
  createdAt: string;
  updatedAt: string;
  revision: number;
  warnings: string[];
  costBreakdown?: {
    sharedUpstreamUsd: number;
    layoutReviewUsd: number;
    imageGenerationUsd: number;
    postRenderQaUsd: number;
    correctionUsd: number;
    verificationUsd: number;
    totalAiUsd: number;
  };
}
export interface CampaignVariantSession {
  family: CampaignVariantFamily;
  productionFamily?: ApprovedProductionFamily;
  cacheHit: boolean;
  actualCostUsd: number;
}
export interface CampaignFamilyVisualReview {
  variantReviews: Array<{
    variantId: string;
    formatId: string;
    status: "approved" | "blocked";
    qaSessionId?: string;
    findings: Array<{
      variantId: string;
      scope: "variant" | "campaign";
      issue: string;
    }>;
  }>;
  familyConsistency: {
    campaignIdentityConsistency: number;
    creativeDeviceConsistency: number;
    messageHierarchyConsistency: number;
    brandConsistency: number;
    heroConsistency: number;
  };
  campaignIssues: string[];
  status: "approved" | "partial" | "blocked";
}
export interface CampaignFamilyRepository {
  create(
    family: CampaignVariantFamily,
    expectedProjectRevision: number,
  ): Promise<CampaignVariantFamily>;
  save(
    family: CampaignVariantFamily,
    expectedRevision: number,
  ): Promise<CampaignVariantFamily>;
  get(
    projectId: string,
    familyId: string,
  ): Promise<CampaignVariantFamily | undefined>;
  findByOperation(
    projectId: string,
    operationId: string,
  ): Promise<CampaignVariantFamily | undefined>;
  latest(projectId: string): Promise<CampaignVariantFamily | undefined>;
  approve(
    family: CampaignVariantFamily,
    authority: CampaignFamilyAuthority,
    expectedRevision: number,
  ): Promise<{
    family: CampaignVariantFamily;
    authority: CampaignFamilyAuthority;
  }>;
  saveAuthority(
    authority: CampaignFamilyAuthority,
  ): Promise<CampaignFamilyAuthority>;
  getAuthority(
    projectId: string,
    familyAuthorityId: string,
  ): Promise<CampaignFamilyAuthority | undefined>;
  saveExport(
    session: CampaignFamilyExportSession,
  ): Promise<CampaignFamilyExportSession>;
  getExport(
    projectId: string,
    exportSessionId: string,
  ): Promise<CampaignFamilyExportSession | undefined>;
  listExports(
    projectId: string,
    familyId?: string,
  ): Promise<CampaignFamilyExportSession[]>;
  health(): Promise<{
    status: "ok" | "degraded";
    kind: "durable" | "memory" | "unavailable";
  }>;
}
