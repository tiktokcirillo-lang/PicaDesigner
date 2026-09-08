import { createHash, randomUUID } from "node:crypto";
import {
  assertMetadataOnly,
  OptimisticConcurrencyError,
  PROJECT_PERSISTENCE_SCHEMA_VERSION,
  ProductionAuthorityPersistenceError,
  type ActiveAssetResolution,
  type DurableExportSessionRecord,
  type DurableProjectRecord,
  type ProductionAuthorityRecord,
  type ProjectPersistenceRepository,
  type SafeProjectState,
  type SaveAuthorityInput,
  type SaveWorkflowInput,
  type WorkflowCheckpoint,
  type WorkflowStage,
} from "../../domain/project-persistence/index.js";
export interface MockDurableDatabase {
  projects: Record<string, DurableProjectRecord>;
  versions: Record<
    string,
    { projectId: string; versionId: string; revision: number; status: "active" }
  >;
  checkpoints: WorkflowCheckpoint[];
  authorities: ProductionAuthorityRecord[];
  exports: DurableExportSessionRecord[];
  available: boolean;
}
export const createMockDurableDatabase = (): MockDurableDatabase => ({
  projects: {},
  versions: {},
  checkpoints: [],
  authorities: [],
  exports: [],
  available: true,
});
const clone = <T>(value: T): T => structuredClone(value),
  id = (prefix: string, value: string) =>
    `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
const activeResolutions = (
  input: SaveAuthorityInput,
): ActiveAssetResolution[] => {
  const session = input.visualApprovedPackage.generatedAssetSession,
    active = session?.activeGeneratedAssets ?? session?.generatedAssets ?? [];
  return active.map((asset) => ({
    requirementId: asset.requirementId,
    assetId: asset.id,
    backingRef: asset.backingRef,
    checksum: asset.checksum,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
  }));
};
export class MockDurableProjectRepository implements ProjectPersistenceRepository {
  constructor(private readonly db: MockDurableDatabase) {}
  private ready() {
    if (!this.db.available)
      throw new ProductionAuthorityPersistenceError(
        "Durable project database is unavailable.",
      );
  }
  async createProject(input: {
    projectId?: string;
    name?: string;
    operationId: string;
  }) {
    this.ready();
    const existing = Object.values(this.db.projects).find(
      (project) => project.projectId === input.projectId,
    );
    if (existing) return clone(existing);
    const now = new Date().toISOString(),
      projectId = input.projectId ?? `project_${randomUUID()}`,
      record: DurableProjectRecord = {
        projectId,
        name: input.name?.trim() || "Untitled Project",
        schemaVersion: PROJECT_PERSISTENCE_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        status: "active",
        revision: 1,
      };
    this.db.projects[projectId] = record;
    return clone(record);
  }
  async updateProject(input: {
    projectId: string;
    expectedRevision: number;
    name?: string;
    status?: "active" | "archived";
  }) {
    this.ready();
    const current = this.db.projects[input.projectId];
    if (!current) throw new Error("Project not found.");
    if (current.revision !== input.expectedRevision)
      throw new OptimisticConcurrencyError();
    const updated = {
      ...current,
      name:
        input.name === undefined
          ? current.name
          : input.name.trim() || "Untitled Project",
      status: input.status ?? current.status,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.db.projects[input.projectId] = updated;
    return clone(updated);
  }
  async getProject(projectId: string) {
    this.ready();
    const value = this.db.projects[projectId];
    return value ? clone(value) : undefined;
  }
  async listProjects() {
    this.ready();
    return clone(
      Object.values(this.db.projects).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
  }
  async saveWorkflowCheckpoint(input: SaveWorkflowInput) {
    this.ready();
    assertMetadataOnly(input.payload);
    const duplicate = this.db.checkpoints.find(
      (item) =>
        item.projectId === input.projectId &&
        (item.operationId === input.operationId ||
          (item.stage === input.stage &&
            item.fingerprint === input.fingerprint)),
    );
    if (duplicate) return clone(duplicate);
    const project = this.db.projects[input.projectId];
    if (!project) throw new Error("Project not found.");
    if (project.revision !== input.expectedRevision)
      throw new OptimisticConcurrencyError();
    const now = new Date().toISOString(),
      revision = project.revision + 1,
      checkpoint: WorkflowCheckpoint = {
        checkpointId: id(
          "checkpoint",
          `${input.projectId}:${input.operationId}`,
        ),
        ...input,
        revision,
        createdAt: now,
      };
    this.db.checkpoints.push(checkpoint);
    this.db.versions[`${input.projectId}:${input.versionId}`] = {
      projectId: input.projectId,
      versionId: input.versionId,
      revision,
      status: "active",
    };
    this.db.projects[input.projectId] = {
      ...project,
      revision,
      updatedAt: now,
      activeVersionId: input.versionId,
    };
    return clone(checkpoint);
  }
  async getLatestWorkflow(projectId: string) {
    this.ready();
    const latest = new Map<WorkflowStage, WorkflowCheckpoint>();
    for (const item of this.db.checkpoints
      .filter((value) => value.projectId === projectId)
      .sort((a, b) => a.revision - b.revision))
      latest.set(item.stage, item);
    return clone([...latest.values()]);
  }
  async saveProductionAuthority(input: SaveAuthorityInput) {
    this.ready();
    assertMetadataOnly(input.visualApprovedPackage);
    assertMetadataOnly(input.postRenderReview);
    const duplicate = this.db.authorities.find(
      (item) =>
        item.projectId === input.projectId &&
        (item.operationId === input.operationId ||
          item.fingerprint === input.fingerprint),
    );
    if (duplicate) return clone(duplicate);
    if (
      !input.postRenderReview.visualApproved ||
      input.visualApprovedPackage.visualApprovalStatus !== "approved"
    )
      throw new ProductionAuthorityPersistenceError(
        "Visual approval is required.",
      );
    const project = this.db.projects[input.projectId];
    if (!project) throw new Error("Project not found.");
    if (project.revision !== input.expectedRevision)
      throw new OptimisticConcurrencyError();
    const now = new Date().toISOString(),
      authorityId = id("authority", `${input.projectId}:${input.fingerprint}`),
      record: ProductionAuthorityRecord = {
        authorityId,
        projectId: input.projectId,
        versionId: input.versionId,
        operationId: input.operationId,
        fingerprint: input.fingerprint,
        postRenderReviewSessionId: input.postRenderReview.sessionId,
        renderSessionId: input.visualApprovedPackage.renderSession.sessionId,
        status: "valid",
        visualApprovedPackage: clone(input.visualApprovedPackage),
        postRenderReview: clone(input.postRenderReview),
        activeAssetResolutions: activeResolutions(input),
        createdAt: now,
      };
    this.db.authorities.push(record);
    this.db.projects[input.projectId] = {
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      status: "production_ready",
      activeVersionId: input.versionId,
      latestProductionAuthorityId: authorityId,
    };
    return clone(record);
  }
  async getProductionAuthority(projectId: string, authorityId?: string) {
    this.ready();
    const project = this.db.projects[projectId],
      resolved = authorityId ?? project?.latestProductionAuthorityId,
      record = this.db.authorities.find(
        (item) => item.projectId === projectId && item.authorityId === resolved,
      );
    return record ? clone(record) : undefined;
  }
  async saveExportSession(input: {
    projectId: string;
    authorityId: string;
    operationId: string;
    session: import("../../domain/export-engine/index.js").ProductionExportSession;
  }) {
    this.ready();
    assertMetadataOnly(input.session);
    const duplicate = this.db.exports.find(
      (item) =>
        item.projectId === input.projectId &&
        (item.operationId === input.operationId ||
          (item.authorityId === input.authorityId &&
            item.inputFingerprint === input.session.inputFingerprint)),
    );
    if (duplicate) return clone(duplicate);
    if (
      !this.db.authorities.some(
        (item) =>
          item.projectId === input.projectId &&
          item.authorityId === input.authorityId,
      )
    )
      throw new Error("Production authority not found.");
    const record: DurableExportSessionRecord = {
      exportSessionId: input.session.sessionId,
      projectId: input.projectId,
      authorityId: input.authorityId,
      operationId: input.operationId,
      inputFingerprint: input.session.inputFingerprint,
      profile: input.session.profile,
      status: input.session.status,
      session: clone(input.session),
      createdAt: new Date().toISOString(),
    };
    this.db.exports.push(record);
    return clone(record);
  }
  async getExportSession(projectId: string, exportSessionId: string) {
    this.ready();
    const record = this.db.exports.find(
      (item) =>
        item.projectId === projectId &&
        item.exportSessionId === exportSessionId,
    );
    return record ? clone(record) : undefined;
  }
  async listExportSessions(projectId: string) {
    this.ready();
    return clone(
      this.db.exports.filter((item) => item.projectId === projectId),
    );
  }
  async getSafeProjectState(
    projectId: string,
  ): Promise<SafeProjectState | undefined> {
    const project = await this.getProject(projectId);
    if (!project) return;
    const workflow = Object.fromEntries(
        (await this.getLatestWorkflow(projectId)).map((item) => [
          item.stage,
          item.payload,
        ]),
      ),
      authority = await this.getProductionAuthority(projectId),
      exports = await this.listExportSessions(projectId);
    return {
      project,
      activeVersionId: project.activeVersionId,
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
  async getProjectHistory(projectId: string) {
    const checkpoints = this.db.checkpoints
      .filter((x) => x.projectId === projectId)
      .sort((a, b) => b.revision - a.revision);
    const authorities = this.db.authorities
      .filter((x) => x.projectId === projectId)
      .map(
        ({ visualApprovedPackage: _, postRenderReview: __, ...safe }) => safe,
      );
    const exports = this.db.exports
      .filter((x) => x.projectId === projectId)
      .map(({ session, ...record }) => ({
        ...record,
        artifacts: session.artifacts,
      }));
    return clone({ checkpoints, authorities, exports });
  }
  async health() {
    return {
      status: this.db.available ? ("ok" as const) : ("degraded" as const),
      kind: "durable" as const,
    };
  }
}
