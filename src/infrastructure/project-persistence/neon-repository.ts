import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  assertMetadataOnly,
  OptimisticConcurrencyError,
  PROJECT_PERSISTENCE_SCHEMA_VERSION,
  PersistenceUnavailableError,
  type DurableExportSessionRecord,
  type DurableProjectRecord,
  type ProductionAuthorityRecord,
  type ProjectPersistenceRepository,
  type SafeProjectState,
  type SaveAuthorityInput,
  type SaveWorkflowInput,
  type WorkflowCheckpoint,
} from "../../domain/project-persistence/index.js";
type Row = Record<string, unknown>;
const json = <T>(value: unknown) =>
  typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
const project = (r: Row): DurableProjectRecord => ({
  projectId: String(r.project_id),
  schemaVersion: PROJECT_PERSISTENCE_SCHEMA_VERSION,
  createdAt: new Date(String(r.created_at)).toISOString(),
  updatedAt: new Date(String(r.updated_at)).toISOString(),
  status: r.status as DurableProjectRecord["status"],
  revision: Number(r.revision),
  activeVersionId: r.active_version_id
    ? String(r.active_version_id)
    : undefined,
  latestProductionAuthorityId: r.latest_production_authority_id
    ? String(r.latest_production_authority_id)
    : undefined,
});
export class NeonProjectPersistenceRepository implements ProjectPersistenceRepository {
  private readonly sql: NeonQueryFunction<false, false>;
  constructor(databaseUrl: string) {
    if (!databaseUrl)
      throw new PersistenceUnavailableError(
        "DATABASE_URL is required in production.",
      );
    this.sql = neon(databaseUrl);
  }
  async createProject(input: { projectId?: string; operationId: string }) {
    const id = input.projectId ?? `project_${crypto.randomUUID()}`,
      rows = await this.sql.query(
        "INSERT INTO projects(project_id,schema_version,created_at,updated_at,status,revision) VALUES($1,$2,now(),now(),'active',1) ON CONFLICT(project_id) DO UPDATE SET project_id=EXCLUDED.project_id RETURNING *",
        [id, PROJECT_PERSISTENCE_SCHEMA_VERSION],
      );
    return project(rows[0] as Row);
  }
  async getProject(id: string) {
    const rows = await this.sql.query(
      "SELECT * FROM projects WHERE project_id=$1",
      [id],
    );
    return rows[0] ? project(rows[0] as Row) : undefined;
  }
  async listProjects() {
    return (
      await this.sql.query("SELECT * FROM projects ORDER BY updated_at DESC")
    ).map((row) => project(row as Row));
  }
  async saveWorkflowCheckpoint(input: SaveWorkflowInput) {
    assertMetadataOnly(input.payload);
    const existing = await this.sql.query(
      "SELECT * FROM workflow_checkpoints WHERE project_id=$1 AND (operation_id=$2 OR (stage=$3 AND fingerprint=$4)) LIMIT 1",
      [input.projectId, input.operationId, input.stage, input.fingerprint],
    );
    if (existing[0]) return this.checkpoint(existing[0] as Row);
    const rows = await this.sql.query(
      "WITH bumped AS (UPDATE projects SET revision=revision+1,updated_at=now(),active_version_id=$2 WHERE project_id=$1 AND revision=$3 RETURNING revision), versioned AS (INSERT INTO project_versions(version_id,project_id,revision,created_at,status) SELECT $2,$1,revision,now(),'active' FROM bumped ON CONFLICT(project_id,version_id) DO UPDATE SET revision=EXCLUDED.revision,status='active') INSERT INTO workflow_checkpoints(checkpoint_id,project_id,version_id,stage,operation_id,fingerprint,revision,payload,created_at) SELECT $4,$1,$2,$5,$6,$7,revision,$8::jsonb,now() FROM bumped RETURNING *",
      [
        input.projectId,
        input.versionId,
        input.expectedRevision,
        `checkpoint_${crypto.randomUUID()}`,
        input.stage,
        input.operationId,
        input.fingerprint,
        JSON.stringify(input.payload),
      ],
    );
    if (!rows[0]) throw new OptimisticConcurrencyError();
    return this.checkpoint(rows[0] as Row);
  }
  private checkpoint(r: Row): WorkflowCheckpoint {
    return {
      checkpointId: String(r.checkpoint_id),
      projectId: String(r.project_id),
      versionId: String(r.version_id),
      stage: r.stage as WorkflowCheckpoint["stage"],
      operationId: String(r.operation_id),
      fingerprint: String(r.fingerprint),
      revision: Number(r.revision),
      payload: json(r.payload),
      createdAt: new Date(String(r.created_at)).toISOString(),
    };
  }
  async getLatestWorkflow(projectId: string) {
    const rows = await this.sql.query(
      "SELECT DISTINCT ON(stage) * FROM workflow_checkpoints WHERE project_id=$1 ORDER BY stage,revision DESC",
      [projectId],
    );
    return rows.map((row) => this.checkpoint(row as Row));
  }
  async saveProductionAuthority(input: SaveAuthorityInput) {
    assertMetadataOnly(input.visualApprovedPackage);
    assertMetadataOnly(input.postRenderReview);
    const existing = await this.sql.query(
      "SELECT * FROM production_authorities WHERE project_id=$1 AND (operation_id=$2 OR fingerprint=$3) LIMIT 1",
      [input.projectId, input.operationId, input.fingerprint],
    );
    if (existing[0]) return this.authority(existing[0] as Row);
    if (
      !input.postRenderReview.visualApproved ||
      input.visualApprovedPackage.visualApprovalStatus !== "approved"
    )
      throw new Error("Visual approval is required.");
    const active = (
        input.visualApprovedPackage.generatedAssetSession
          ?.activeGeneratedAssets ??
        input.visualApprovedPackage.generatedAssetSession?.generatedAssets ??
        []
      ).map((asset) => ({
        requirementId: asset.requirementId,
        assetId: asset.id,
        backingRef: asset.backingRef,
        checksum: asset.checksum,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
      })),
      authorityId = `authority_${crypto.randomUUID()}`,
      rows = await this.sql.query(
        "WITH inserted AS (INSERT INTO production_authorities(authority_id,project_id,version_id,operation_id,fingerprint,post_render_review_session_id,render_session_id,status,visual_approved_package,post_render_review,active_asset_resolutions,created_at) SELECT $4,$1,$2,$5,$6,$7,$8,'valid',$9::jsonb,$10::jsonb,$11::jsonb,now() FROM projects WHERE project_id=$1 AND revision=$3 RETURNING *), updated AS (UPDATE projects SET revision=revision+1,updated_at=now(),status='production_ready',active_version_id=$2,latest_production_authority_id=$4 WHERE project_id=$1 AND revision=$3 AND EXISTS(SELECT 1 FROM inserted)) SELECT * FROM inserted",
        [
          input.projectId,
          input.versionId,
          input.expectedRevision,
          authorityId,
          input.operationId,
          input.fingerprint,
          input.postRenderReview.sessionId,
          input.visualApprovedPackage.renderSession.sessionId,
          JSON.stringify(input.visualApprovedPackage),
          JSON.stringify(input.postRenderReview),
          JSON.stringify(active),
        ],
      );
    if (!rows[0]) throw new OptimisticConcurrencyError();
    return this.authority(rows[0] as Row);
  }
  private authority(r: Row): ProductionAuthorityRecord {
    return {
      authorityId: String(r.authority_id),
      projectId: String(r.project_id),
      versionId: String(r.version_id),
      operationId: String(r.operation_id),
      fingerprint: String(r.fingerprint),
      postRenderReviewSessionId: String(r.post_render_review_session_id),
      renderSessionId: String(r.render_session_id),
      status: r.status as ProductionAuthorityRecord["status"],
      visualApprovedPackage: json(r.visual_approved_package),
      postRenderReview: json(r.post_render_review),
      activeAssetResolutions: json(r.active_asset_resolutions),
      createdAt: new Date(String(r.created_at)).toISOString(),
    };
  }
  async getProductionAuthority(projectId: string, authorityId?: string) {
    const rows = await this.sql.query(
      authorityId
        ? "SELECT * FROM production_authorities WHERE project_id=$1 AND authority_id=$2"
        : "SELECT a.* FROM production_authorities a JOIN projects p ON p.latest_production_authority_id=a.authority_id WHERE p.project_id=$1",
      authorityId ? [projectId, authorityId] : [projectId],
    );
    return rows[0] ? this.authority(rows[0] as Row) : undefined;
  }
  async saveExportSession(input: {
    projectId: string;
    authorityId: string;
    operationId: string;
    session: import("../../domain/export-engine/index.js").ProductionExportSession;
  }) {
    assertMetadataOnly(input.session);
    const rows = await this.sql.query(
      "INSERT INTO production_export_sessions(export_session_id,project_id,authority_id,operation_id,input_fingerprint,profile,status,session_metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now()) ON CONFLICT(project_id,operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *",
      [
        input.session.sessionId,
        input.projectId,
        input.authorityId,
        input.operationId,
        input.session.inputFingerprint,
        input.session.profile,
        input.session.status,
        JSON.stringify(input.session),
      ],
    );
    return this.exportRecord(rows[0] as Row);
  }
  private exportRecord(r: Row): DurableExportSessionRecord {
    return {
      exportSessionId: String(r.export_session_id),
      projectId: String(r.project_id),
      authorityId: String(r.authority_id),
      operationId: String(r.operation_id),
      inputFingerprint: String(r.input_fingerprint),
      profile: String(r.profile),
      status: r.status as DurableExportSessionRecord["status"],
      session: json(r.session_metadata),
      createdAt: new Date(String(r.created_at)).toISOString(),
    };
  }
  async getExportSession(projectId: string, id: string) {
    const rows = await this.sql.query(
      "SELECT * FROM production_export_sessions WHERE project_id=$1 AND export_session_id=$2",
      [projectId, id],
    );
    return rows[0] ? this.exportRecord(rows[0] as Row) : undefined;
  }
  async listExportSessions(projectId: string) {
    return (
      await this.sql.query(
        "SELECT * FROM production_export_sessions WHERE project_id=$1 ORDER BY created_at DESC",
        [projectId],
      )
    ).map((row) => this.exportRecord(row as Row));
  }
  async getSafeProjectState(
    projectId: string,
  ): Promise<SafeProjectState | undefined> {
    const p = await this.getProject(projectId);
    if (!p) return;
    const workflow = Object.fromEntries(
        (await this.getLatestWorkflow(projectId)).map((item) => [
          item.stage,
          item.payload,
        ]),
      ),
      authority = await this.getProductionAuthority(projectId),
      exports = await this.listExportSessions(projectId);
    return {
      project: p,
      activeVersionId: p.activeVersionId,
      workflow,
      latestProductionAuthority: authority
        ? (({ visualApprovedPackage: _, postRenderReview: __, ...safe }) =>
            safe)(authority)
        : undefined,
      activeAssetResolutions: authority?.activeAssetResolutions ?? [],
      exports: exports.map(({ session, ...record }) => ({
        ...record,
        artifacts: session.artifacts,
      })),
    };
  }
  async health() {
    try {
      await this.sql.query("SELECT 1");
      return { status: "ok" as const, kind: "durable" as const };
    } catch {
      return { status: "degraded" as const, kind: "durable" as const };
    }
  }
}
