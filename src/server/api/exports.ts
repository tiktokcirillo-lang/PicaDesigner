import { Router } from "express";
import { createProductionExport } from "../../application/export-engine/index.js";
import type {
  ExportFormat,
  ExportProfile,
} from "../../domain/export-engine/index.js";
import { applicationGeneratedAssetStore } from "../../infrastructure/image-generation/index.js";
import {
  applicationProductionArtifactStore,
  loadExportConfig,
  NodeProductionRasterEncoder,
  SafeSelfContainedSvgExporter,
} from "../../infrastructure/export-engine/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import {validateProductionAuthorityBacking} from '../../application/project-persistence/index.js';
type CreateBody = {
  projectId: string;
  authorityId?: string;
  formats: ExportFormat[];
  profile?: ExportProfile;
  sceneIds?: string[];
  includeManifest?: boolean;
  includePdf?: boolean;
  includeZip?: boolean;
  projectSlug?: string;
  operationId?: string;
};
export const createExportsRouter = () => {
  const router = Router(),
    config = loadExportConfig();
  router.post("/create", async (req, res) => {
    try {
      const body = req.body as CreateBody;
      if (
        !body.projectId ||
        !Array.isArray(body.formats) ||
        "visualApprovedPackage" in (req.body ?? {})
      )
        return res
          .status(400)
          .json({
            error: "Server-side production authority and formats are required.",
          });
      const authority =
        await applicationProjectRepository.getProductionAuthority(
          body.projectId,
          body.authorityId,
        );
      if (!authority || authority.status !== "valid")
        return res
          .status(403)
          .json({ error: "Valid production authority was not found." });
      const authorityHealth=await validateProductionAuthorityBacking(authority,applicationGeneratedAssetStore);if(!authorityHealth.valid)return res.status(409).json({error:'Production authority backing is degraded.',missingAssets:authorityHealth.missing});
      const existing = (
          await applicationProjectRepository.listExportSessions(body.projectId)
        ).find(
          (item) =>
            item.authorityId === authority.authorityId &&
            item.session.profile === (body.profile ?? "social_png"),
        )?.session,
        result = await createProductionExport(
          {
            ...body,
            visualApprovedPackage: authority.visualApprovedPackage,
            existingSession: existing,
          },
          {
            assetStore: applicationGeneratedAssetStore,
            artifactStore: applicationProductionArtifactStore,
            rasterEncoder: new NodeProductionRasterEncoder(),
            svgExporter: new SafeSelfContainedSvgExporter(),
            maxSingleFileMb: config.maxSingleFileMb,
            maxPackageMb: config.maxPackageMb,
          },
        );
      await applicationProjectRepository.saveExportSession({
        projectId: body.projectId,
        authorityId: authority.authorityId,
        operationId: body.operationId ?? `export:${result.inputFingerprint}`,
        session: result,
      });
      const debug =
        req.query.debug === "export"
          ? {
              preflight: "passed",
              authorityId: authority.authorityId,
              sceneCount:
                result.manifest?.scenes.length ??
                result.artifacts.filter((artifact) => artifact.sceneId).length,
              requestedFormats: body.formats,
              artifacts: result.artifacts.map((artifact) => ({
                id: artifact.artifactId,
                format: artifact.format,
                dimensions: [artifact.width, artifact.height],
                checksum: artifact.checksum,
              })),
              activeAssetCount: authority.activeAssetResolutions.length,
              historicalAssetsIgnored:
                authority.visualApprovedPackage.generatedAssetSession
                  ?.historicalGeneratedAssets?.length ?? 0,
              cacheHit: result.cacheHit,
              packageStatus: result.status,
              storageKind: result.storageKind,
            }
          : undefined;
      return res.json(debug ? { ...result, debugExport: debug } : result);
    } catch (error) {
      return res
        .status(503)
        .json({
          error:
            error instanceof Error &&
            error.name === "OptimisticConcurrencyError"
              ? error.message
              : "Production export is temporarily unavailable.",
        });
    }
  });
  router.post("/read-handle", async (req, res) => {
    try {
      const { projectId, exportSessionId, artifactId } = req.body ?? {},
        record = await applicationProjectRepository.getExportSession(
          String(projectId),
          String(exportSessionId),
        );
      if (!record)
        return res.status(403).json({ error: "Export lineage is invalid." });
      const artifact = record.session.artifacts.find(
        (item) => item.artifactId === artifactId,
      );
      if (
        !artifact?.backingRef ||
        !(await applicationProductionArtifactStore.exists(
          artifact.backingRef,
          projectId,
        ))
      )
        return res
          .status(404)
          .json({
            error: "Export artifact unavailable.",
            canReExport: Boolean(
              await applicationProjectRepository.getProductionAuthority(
                projectId,
                record.authorityId,
              ),
            ),
          });
      if (applicationProductionArtifactStore.kind === "memory")
        return res.json({
          url: `/api/exports/download?projectId=${encodeURIComponent(projectId)}&exportSessionId=${encodeURIComponent(exportSessionId)}&artifactId=${encodeURIComponent(artifactId)}`,
          expiresAt: new Date(
            Date.now() + config.readHandleTtlSeconds * 1000,
          ).toISOString(),
          mediaType: artifact.mediaType,
          filename: artifact.filename,
        });
      if (!applicationProductionArtifactStore.createReadHandle)
        return res
          .status(503)
          .json({ error: "Private downloads unavailable." });
      return res.json(
        await applicationProductionArtifactStore.createReadHandle(
          artifact.backingRef,
          projectId,
          artifact.mediaType,
          artifact.filename,
          config.readHandleTtlSeconds,
        ),
      );
    } catch {
      return res.status(404).json({ error: "Export artifact unavailable." });
    }
  });
  router.get("/download", async (req, res) => {
    try {
      const projectId = String(req.query.projectId ?? ""),
        record = await applicationProjectRepository.getExportSession(
          projectId,
          String(req.query.exportSessionId ?? ""),
        );
      if (!record) return res.status(403).end();
      const artifact = record.session.artifacts.find(
        (item) => item.artifactId === String(req.query.artifactId ?? ""),
      );
      if (!artifact?.backingRef) return res.status(404).end();
      const bytes = await applicationProductionArtifactStore.get(
        artifact.backingRef,
        projectId,
      );
      if (!bytes) return res.status(404).end();
      res.setHeader("Content-Type", artifact.mediaType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${artifact.filename.replace(/["\\\r\n]/g, "-")}"`,
      );
      return res.send(Buffer.from(bytes));
    } catch {
      return res.status(404).end();
    }
  });
  return router;
};
