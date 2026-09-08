import type {
  DurableProjectRecord,
  SafeProjectState,
  WorkflowCheckpoint,
  WorkflowStage,
} from "../domain/project-persistence/index.js";
import { parseApiResponse } from "./api-response.js";
export type ProjectHistoryResponse = {
  checkpoints: WorkflowCheckpoint[];
  authorities: Array<{
    authorityId: string;
    createdAt: string;
    status: string;
  }>;
  exports: Array<{
    exportSessionId: string;
    createdAt: string;
    status: string;
    artifacts: Array<{ artifactId: string; format: string; filename: string }>;
  }>;
};
const jsonHeaders = { "Content-Type": "application/json" };
export const createProject = async (name?: string) =>
  parseApiResponse<DurableProjectRecord>(
    await fetch("/api/projects", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name, operationId: `create:${Date.now()}` }),
    }),
  );
export const ensureDurableProject = async (projectId: string) =>
  parseApiResponse<DurableProjectRecord>(
    await fetch("/api/projects", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ projectId, operationId: `create:${projectId}` }),
    }),
  );
export const listProjects = async (signal?: AbortSignal) =>
  parseApiResponse<{ projects: DurableProjectRecord[] }>(
    await fetch("/api/projects", { signal }),
  );
export const getProjectState = async (
  projectId: string,
  signal?: AbortSignal,
) =>
  parseApiResponse<SafeProjectState>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/state`, {
      signal,
    }),
  );
export const restoreDurableProject = getProjectState;
export const updateProject = async (input: {
  projectId: string;
  expectedRevision: number;
  name?: string;
  status?: "active" | "archived";
}) =>
  parseApiResponse<{ project: DurableProjectRecord }>(
    await fetch(`/api/projects/${encodeURIComponent(input.projectId)}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
export const saveDurableCheckpoint = async (input: {
  projectId: string;
  versionId: string;
  stage: WorkflowStage;
  operationId: string;
  fingerprint: string;
  expectedRevision: number;
  payload: unknown;
}) =>
  parseApiResponse<{
    checkpoint: WorkflowCheckpoint;
    project: DurableProjectRecord;
  }>(
    await fetch(
      `/api/projects/${encodeURIComponent(input.projectId)}/checkpoints`,
      { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) },
    ),
  );
export const getProjectHistory = async (
  projectId: string,
  signal?: AbortSignal,
) =>
  parseApiResponse<ProjectHistoryResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/history`, {
      signal,
    }),
  );
