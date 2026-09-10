import { Router } from "express";
import {
  InvalidDurablePayloadError,
  OptimisticConcurrencyError,
  PersistenceUnavailableError,
  type WorkflowStage,
} from "../../domain/project-persistence/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import { validateProductionAuthorityBacking } from "../../application/project-persistence/index.js";
import { applicationGeneratedAssetStore } from "../../infrastructure/image-generation/index.js";
import { applicationCampaignFamilyRepository } from "../../infrastructure/campaign-variants/index.js";
const repositoryFailure = (error: unknown) =>
  error instanceof PersistenceUnavailableError ||
  (error instanceof Error &&
    (/Neon|database|fetch failed|ECONN|timeout/i.test(error.name) ||
      /ECONN|database.*unavailable|connection.*(?:failed|closed)|fetch failed/i.test(
        error.message,
      )));
const safeError = (error: unknown) => {
  const code = error instanceof Error ? error.name : "UnknownError";
  console.error("project_api_failure", {
    errorClass: code,
    errorCode:
      typeof (error as { code?: unknown })?.code === "string"
        ? (error as { code: string }).code
        : undefined,
  });
  if (error instanceof OptimisticConcurrencyError)
    return {
      status: 409,
      message: error.message,
      code: "PROJECT_REVISION_CONFLICT",
    };
  if (error instanceof InvalidDurablePayloadError)
    return {
      status: 422,
      message: "Durable project payload is invalid.",
      code: "PROJECT_INVALID_DURABLE_PAYLOAD",
    };
  if (repositoryFailure(error))
    return {
      status: 503,
      message: "Durable project persistence is unavailable.",
      code: "PROJECT_PERSISTENCE_UNAVAILABLE",
    };
  return {
    status: 500,
    message: "Project operation failed safely.",
    code: "PROJECT_APPLICATION_ERROR",
  };
};
export const createProjectsRouter = () => {
  const router = Router();
  router.post("/", async (req, res) => {
    try {
      const { projectId, name, operationId } = req.body ?? {};
      return res.status(201).json(
        await applicationProjectRepository.createProject({
          projectId,
          name: typeof name === "string" ? name.slice(0, 160) : undefined,
          operationId: String(operationId ?? `create:${projectId ?? "server"}`),
        }),
      );
    } catch (error) {
      const safe = safeError(error);
      return res
        .status(safe.status)
        .json({ error: safe.message, code: safe.code });
    }
  });
  router.patch("/:projectId", async (req, res) => {
    try {
      const { name, status, expectedRevision } = req.body ?? {};
      if (
        !Number.isInteger(expectedRevision) ||
        (name === undefined && status === undefined) ||
        !([undefined, "active", "archived"] as unknown[]).includes(status)
      )
        return res.status(400).json({ error: "Invalid project update." });
      const project = await applicationProjectRepository.updateProject({
        projectId: req.params.projectId,
        expectedRevision,
        name: typeof name === "string" ? name.slice(0, 160) : undefined,
        status,
      });
      return res.json({ project });
    } catch (error) {
      const safe = safeError(error);
      return res
        .status(safe.status)
        .json({ error: safe.message, code: safe.code });
    }
  });
  router.get("/", async (_req, res) => {
    try {
      return res.json({
        projects: await applicationProjectRepository.listProjects(),
      });
    } catch {
      return res
        .status(503)
        .json({ error: "Project persistence unavailable." });
    }
  });
  router.get("/:projectId/state", async (req, res) => {
    try {
      const state = await applicationProjectRepository.getSafeProjectState(
        req.params.projectId,
      );
      if (state) {
        state.latestCampaignFamily =
          await applicationCampaignFamilyRepository.latest(
            req.params.projectId,
          );
        if (state.latestCampaignFamily?.approval.familyAuthorityId)
          state.latestCampaignFamilyAuthority =
            await applicationCampaignFamilyRepository.getAuthority(
              req.params.projectId,
              state.latestCampaignFamily.approval.familyAuthorityId,
            );
        const familyExports =
          await applicationCampaignFamilyRepository.listExports(
            req.params.projectId,
            state.latestCampaignFamily?.familyId,
          );
        state.campaignFamilyExports = familyExports.map(
          ({ artifact, ...session }) => ({
            ...session,
            artifact: {
              artifactId: artifact.artifactId,
              filename: artifact.filename,
              format: artifact.format,
              mediaType: artifact.mediaType,
              byteSize: artifact.byteSize,
              checksum: artifact.checksum,
              status: artifact.status,
            },
          }),
        );
      }
      if (state?.latestProductionAuthority) {
        const authority =
          await applicationProjectRepository.getProductionAuthority(
            req.params.projectId,
            state.latestProductionAuthority.authorityId,
          );
        if (authority) {
          const health = await validateProductionAuthorityBacking(
            authority,
            applicationGeneratedAssetStore,
          );
          state.latestProductionAuthority.status = health.status;
        }
      }
      return state
        ? res.json(state)
        : res.status(404).json({ error: "Project not found." });
    } catch {
      return res
        .status(503)
        .json({ error: "Project persistence unavailable." });
    }
  });
  router.get("/:projectId/history", async (req, res) => {
    try {
      const project = await applicationProjectRepository.getProject(
        req.params.projectId,
      );
      if (!project)
        return res.status(404).json({ error: "Project not found." });
      return res.json(
        await applicationProjectRepository.getProjectHistory(
          req.params.projectId,
        ),
      );
    } catch {
      return res.status(503).json({ error: "Project history unavailable." });
    }
  });
  router.post("/:projectId/checkpoints", async (req, res) => {
    try {
      const {
        versionId,
        stage,
        operationId,
        fingerprint,
        expectedRevision,
        payload,
      } = req.body ?? {};
      if (
        !versionId ||
        !stage ||
        !operationId ||
        !fingerprint ||
        !Number.isInteger(expectedRevision)
      )
        return res.status(400).json({ error: "Invalid workflow checkpoint." });
      const result = await applicationProjectRepository.saveWorkflowCheckpoint({
          projectId: req.params.projectId,
          versionId,
          stage: stage as WorkflowStage,
          operationId,
          fingerprint,
          expectedRevision,
          payload,
        }),
        project = await applicationProjectRepository.getProject(
          req.params.projectId,
        );
      return res.json({ checkpoint: result, project });
    } catch (error) {
      const safe = safeError(error);
      return res
        .status(safe.status)
        .json({ error: safe.message, code: safe.code });
    }
  });
  return router;
};
