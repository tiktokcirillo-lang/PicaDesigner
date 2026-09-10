import { createHash } from "node:crypto";
import { Router } from "express";
import { materializeSvgAssetsForServer } from "../../infrastructure/post-render-review/index.js";
import { NodeProductionRasterEncoder } from "../../infrastructure/export-engine/index.js";
import { applicationGeneratedAssetStore } from "../../infrastructure/image-generation/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import type { ImageAssetSession } from "../../domain/image-assets/index.js";
import type { RenderSession } from "../../domain/render-engine/index.js";
import { applicationCampaignFamilyRepository } from "../../infrastructure/campaign-variants/index.js";

export const createPreviewRouter = () => {
  const router = Router();
  router.get("/:projectId/preview", async (req, res) => {
    try {
      if (req.query.backingRef || req.query.svg)
        return res
          .status(400)
          .json({ error: "Preview input must be resolved by the server." });
      let variantAuthorityId: string | undefined,
        variantPreview:
          | import("../../domain/campaign-variants/index.js").CampaignVariant
          | undefined;
      if (req.query.familyId || req.query.formatId) {
        if (
          typeof req.query.familyId !== "string" ||
          typeof req.query.formatId !== "string"
        )
          return res
            .status(400)
            .json({ error: "Campaign preview scope is invalid." });
        const family = await applicationCampaignFamilyRepository.get(
            req.params.projectId,
            req.query.familyId,
          ),
          variant = family?.variants.find(
            (v) => v.formatId === req.query.formatId,
          );
        if (
          !family ||
          (!variant?.productionAuthorityId && !variant?.previewRenderSession)
        )
          return res
            .status(404)
            .json({ error: "Campaign variant preview is unavailable." });
        variantAuthorityId = variant.productionAuthorityId;
        variantPreview = variant;
      }
      const authority =
        variantPreview && !variantAuthorityId
          ? undefined
          : await applicationProjectRepository.getProductionAuthority(
              req.params.projectId,
              variantAuthorityId,
            );
      const workflow = await applicationProjectRepository.getLatestWorkflow(
        req.params.projectId,
      );
      const render: RenderSession | undefined =
        authority?.visualApprovedPackage.renderSession ??
        variantPreview?.previewRenderSession ??
        (!variantAuthorityId
          ? (workflow.find((x) => x.stage === "render_session")?.payload as
              RenderSession | undefined)
          : undefined);
      const assets: ImageAssetSession | undefined =
        authority?.visualApprovedPackage.generatedAssetSession ??
        variantPreview?.previewImageAssetSession ??
        (!variantAuthorityId
          ? (workflow.find((x) => x.stage === "image_asset_session")
              ?.payload as ImageAssetSession | undefined)
          : undefined);
      if (!render?.artifacts?.length || !render.renderDocument?.scenes?.length)
        return res.status(404).json({ error: "Preview is not available yet." });
      const sceneIndex = Math.max(
          0,
          Math.min(
            Number(req.query.scene ?? 0) || 0,
            render.artifacts.length - 1,
          ),
        ),
        artifact = render.artifacts[sceneIndex]!,
        scene = render.renderDocument.scenes[sceneIndex]!;
      const svg = await materializeSvgAssetsForServer(
        artifact,
        {
          projectId: req.params.projectId,
          assets:
            assets?.activeGeneratedAssets ?? assets?.generatedAssets ?? [],
        },
        applicationGeneratedAssetStore,
      );
      const maxWidth = 1600,
        width = Math.min(scene.width, maxWidth),
        png = await new NodeProductionRasterEncoder().encodePng(
          svg,
          width,
          Math.round((width * scene.height) / scene.width),
        ),
        etag = createHash("sha256").update(png).digest("hex");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=60");
      res.setHeader("ETag", `\"${etag}\"`);
      res.setHeader(
        "X-PicaDesigner-Preview-Authority",
        authority ? "production" : "non-authoritative",
      );
      return res.send(Buffer.from(png));
    } catch {
      return res.status(409).json({
        error: "A preview could not be produced from the current server state.",
      });
    }
  });
  return router;
};
