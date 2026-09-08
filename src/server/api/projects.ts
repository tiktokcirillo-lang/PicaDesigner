import { Router } from "express";
import {
  OptimisticConcurrencyError,
  type WorkflowStage,
} from "../../domain/project-persistence/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import { validateProductionAuthorityBacking } from "../../application/project-persistence/index.js";
import { applicationGeneratedAssetStore } from "../../infrastructure/image-generation/index.js";
const safeError = (error: unknown) =>
  error instanceof OptimisticConcurrencyError
    ? { status: 409, message: error.message }
    : { status: 503, message: "Durable project persistence is unavailable." };
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
      return res.status(safe.status).json({ error: safe.message });
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
      return res.status(safe.status).json({ error: safe.message });
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
      return res.status(safe.status).json({ error: safe.message });
    }
  });
  return router;
};
