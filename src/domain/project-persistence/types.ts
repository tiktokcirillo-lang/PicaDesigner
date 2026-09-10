import type { ImageAssetSession } from "../image-assets/index.js";
import type { ProductionExportSession } from "../export-engine/index.js";
import type {
  VisualApprovedRenderPackage,
  PostRenderReviewSession,
} from "../post-render-review/index.js";
import type {
  CampaignFamilyAuthority,
  CampaignFamilyExportSession,
  CampaignVariantFamily,
} from "../campaign-variants/index.js";
export const PROJECT_PERSISTENCE_SCHEMA_VERSION = "1.0.0" as const;
export type WorkflowStage =
  | "workspace_input"
  | "reference_intelligence"
  | "brand_intelligence"
  | "creative_direction"
  | "layout"
  | "art_director_review"
  | "render_session"
  | "image_asset_session"
  | "post_render_review";
export interface DurableProjectRecord {
  projectId: string;
  name: string;
  schemaVersion: typeof PROJECT_PERSISTENCE_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  status: "active" | "production_ready" | "archived";
  revision: number;
  activeVersionId?: string;
  latestProductionAuthorityId?: string;
}
export interface WorkflowCheckpoint {
  checkpointId: string;
  projectId: string;
  versionId: string;
  stage: WorkflowStage;
  operationId: string;
  fingerprint: string;
  revision: number;
  payload: unknown;
  createdAt: string;
}
export interface ActiveAssetResolution {
  requirementId: string;
  assetId: string;
  backingRef: string;
  checksum: string;
  mediaType: string;
  width?: number;
  height?: number;
}
export interface ProductionAuthorityRecord {
  authorityId: string;
  projectId: string;
  versionId: string;
  operationId: string;
  fingerprint: string;
  postRenderReviewSessionId: string;
  renderSessionId: string;
  status: "valid" | "degraded" | "invalid";
  visualApprovedPackage: VisualApprovedRenderPackage;
  postRenderReview: PostRenderReviewSession;
  activeAssetResolutions: ActiveAssetResolution[];
  createdAt: string;
}
export interface DurableExportSessionRecord {
  exportSessionId: string;
  projectId: string;
  authorityId: string;
  operationId: string;
  inputFingerprint: string;
  profile: string;
  status: "ready" | "partial" | "failed";
  session: ProductionExportSession;
  createdAt: string;
}
export interface SafeProjectState {
  project: DurableProjectRecord;
  activeVersionId?: string;
  workflow: Record<string, unknown>;
  latestProductionAuthority?: Omit<
    ProductionAuthorityRecord,
    "visualApprovedPackage" | "postRenderReview"
  >;
  activeAssetResolutions: ActiveAssetResolution[];
  exports: Array<
    Omit<DurableExportSessionRecord, "session"> & {
      artifacts: ProductionExportSession["artifacts"];
    }
  >;
  latestCampaignFamily?: CampaignVariantFamily;
  latestCampaignFamilyAuthority?: CampaignFamilyAuthority;
  campaignFamilyExports?: Array<
    Omit<CampaignFamilyExportSession, "artifact"> & {
      artifact: Omit<CampaignFamilyExportSession["artifact"], "backingRef">;
    }
  >;
}
export interface SaveWorkflowInput {
  projectId: string;
  versionId: string;
  stage: WorkflowStage;
  operationId: string;
  fingerprint: string;
  expectedRevision: number;
  payload: unknown;
}
export interface SaveAuthorityInput {
  projectId: string;
  versionId: string;
  operationId: string;
  fingerprint: string;
  expectedRevision: number;
  postRenderReview: PostRenderReviewSession;
  visualApprovedPackage: VisualApprovedRenderPackage;
}
export interface ProjectPersistenceRepository {
  createProject(input: {
    projectId?: string;
    name?: string;
    operationId: string;
  }): Promise<DurableProjectRecord>;
  updateProject(input: {
    projectId: string;
    expectedRevision: number;
    name?: string;
    status?: "active" | "archived";
  }): Promise<DurableProjectRecord>;
  getProject(projectId: string): Promise<DurableProjectRecord | undefined>;
  listProjects(): Promise<DurableProjectRecord[]>;
  saveWorkflowCheckpoint(input: SaveWorkflowInput): Promise<WorkflowCheckpoint>;
  getLatestWorkflow(projectId: string): Promise<WorkflowCheckpoint[]>;
  saveProductionAuthority(
    input: SaveAuthorityInput,
  ): Promise<ProductionAuthorityRecord>;
  getProductionAuthority(
    projectId: string,
    authorityId?: string,
  ): Promise<ProductionAuthorityRecord | undefined>;
  saveExportSession(input: {
    projectId: string;
    authorityId: string;
    operationId: string;
    session: ProductionExportSession;
  }): Promise<DurableExportSessionRecord>;
  getExportSession(
    projectId: string,
    exportSessionId: string,
  ): Promise<DurableExportSessionRecord | undefined>;
  listExportSessions(projectId: string): Promise<DurableExportSessionRecord[]>;
  getSafeProjectState(projectId: string): Promise<SafeProjectState | undefined>;
  getProjectHistory(projectId: string): Promise<{
    checkpoints: WorkflowCheckpoint[];
    authorities: Array<
      Omit<
        ProductionAuthorityRecord,
        "visualApprovedPackage" | "postRenderReview"
      >
    >;
    exports: Array<
      Omit<DurableExportSessionRecord, "session"> & {
        artifacts: ProductionExportSession["artifacts"];
      }
    >;
  }>;
  health(): Promise<{
    status: "ok" | "degraded";
    kind: "durable" | "memory" | "unavailable";
  }>;
}
export type DurableWorkflowSnapshot = {
  creativeDirection?: unknown;
  layout?: unknown;
  artDirectorReview?: unknown;
  renderSession?: unknown;
  imageAssetSession?: ImageAssetSession;
  postRenderReview?: PostRenderReviewSession;
};
