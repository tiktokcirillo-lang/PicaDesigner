import { Router } from "express";
import { createLayoutIntelligence } from "../../application/layout-intelligence/index.js";
import {
  createCampaignFamilyExport,
  ensureCampaignVariantFamily,
  runCampaignFamily,
} from "../../application/campaign-variants/index.js";
import {
  campaignFingerprint,
  evaluateCampaignBudgetPreflight,
  lockCampaignInvariants,
} from "../../domain/campaign-variants/index.js";
import { META_ADS_FAMILY } from "../../domain/layout-engine/index.js";
import type { BrandIntelligenceSession } from "../../domain/brand-intelligence/index.js";
import type { CreativeDirectionSession } from "../../domain/creative-direction/index.js";
import type { ReferenceIntelligenceSession } from "../../application/reference-intelligence/index.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import { applicationCampaignFamilyRepository } from "../../infrastructure/campaign-variants/index.js";
import {
  applicationProjectSourceAssetRepository,
  applicationProjectSourceAssetStore,
} from "../../infrastructure/source-assets/index.js";
import { resolveProjectSourceRegistry } from "../../application/source-assets/index.js";
import { applicationGeneratedAssetStore } from "../../infrastructure/image-generation/index.js";
import { applicationProductionArtifactStore } from "../../infrastructure/export-engine/index.js";
import { applicationBudgetStore } from "../../infrastructure/ai/budget/runtime-store.js";
import { loadOpenAIConfig } from "../../infrastructure/ai/providers/openai/config.js";
import { createCampaignRuntimeAdapters } from "../services/campaign-runtime.js";

const safe = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (key, item) =>
      ["backingRef", "brandDNA", "layoutPlan"].includes(key) ? undefined : item,
    ),
  );
async function shared(projectId: string) {
  const checkpoints =
      await applicationProjectRepository.getLatestWorkflow(projectId),
    get = (stage: string) =>
      checkpoints.find((x) => x.stage === stage)?.payload,
    creative = get("creative_direction") as
      CreativeDirectionSession | undefined,
    brand = get("brand_intelligence") as BrandIntelligenceSession | undefined,
    reference = get("reference_intelligence") as
      ReferenceIntelligenceSession | undefined,
    workspace = get("workspace_input") as
      { copyText?: string; destinationTool?: string } | undefined;
  if (!creative?.selectedRoute || creative.status !== "ready")
    throw new Error("Shared Creative Direction must be ready first.");
  const assets =
      await applicationProjectSourceAssetRepository.listByProject(projectId),
    active = assets.filter((x) => x.status === "available"),
    invariants = lockCampaignInvariants({
      creative,
      approvedCopy: creative.selectedRoute.copyHierarchy.map(
        (x) => x.contentReference,
      ),
      brandFingerprint: brand?.inputFingerprint,
      brandDNA: brand?.brandDNA,
      officialLogoChecksum: active.find((x) => x.role === "official_logo")
        ?.checksum,
      sourceAssetChecksums: active.map((x) => x.checksum),
    });
  return { creative, brand, reference, workspace, assets: active, invariants };
}
const fingerprint = (
  state: Awaited<ReturnType<typeof shared>>,
  primary: string,
) =>
  campaignFingerprint({
    workspace: state.workspace,
    reference: state.reference?.source.imageFingerprint,
    brand: state.brand?.inputFingerprint,
    creative: state.creative.inputFingerprint,
    route: state.creative.selectedRouteId,
    family: META_ADS_FAMILY,
    primary,
    sources: state.invariants.sourceAssetChecksums,
    policy: "1.0.0",
  });
async function preflight(
  projectId: string,
  remainingVariants: number,
  retry: boolean,
  state: Awaited<ReturnType<typeof shared>>,
  family?: import("../../domain/campaign-variants/index.js").CampaignVariantFamily,
) {
  const config = loadOpenAIConfig(),
    snapshot = await applicationBudgetStore.getUsageSnapshot(
      projectId,
      new Date().toISOString().slice(0, 7),
      config.maxProjectCostUsd,
      config.monthlyBudgetUsd,
    ),
    hasResolvedSourceAsset = state.assets.some((asset) =>
      ["product_image", "brand_photo", "graphic_asset"].includes(asset.role),
    ),
    hasReusableGeneratedAsset = Boolean(
      family?.variants.some((variant) => variant.imageAssetSessionId),
    );
  return evaluateCampaignBudgetPreflight({
    actualSpentUsd: snapshot.spentUsd,
    remainingHardCapUsd: snapshot.remainingUsd,
    monthlyRemainingUsd: snapshot.monthlyRemainingUsd,
    remainingVariants,
    reviewCostUsd: 0.052,
    qaCostUsd: config.postRenderQaTargetUsd,
    imageCostUsd: retry ? 0 : Math.min(config.imageGenerationTargetUsd, 0.22),
    verificationCostUsd: config.postRenderQaTargetUsd,
    hasResolvedSourceAsset,
    hasReusableGeneratedAsset,
  });
}

export const createCampaignVariantsRouter = () => {
  const router = Router();
  router.post("/:projectId/campaign-family", async (req, res) => {
    try {
      const {
        familyDefinitionId,
        primaryFormatId,
        expectedRevision,
        operationId,
      } = req.body ?? {};
      if (
        familyDefinitionId !== "meta_ads_family" ||
        !Number.isInteger(expectedRevision) ||
        !operationId
      )
        return res
          .status(400)
          .json({ error: "Invalid campaign family request." });
      const project = await applicationProjectRepository.getProject(
        req.params.projectId,
      );
      if (!project)
        return res.status(404).json({ error: "Project not found." });
      const state = await shared(req.params.projectId),
        primaryId = primaryFormatId ?? "meta_ads_feed_portrait",
        inputFingerprint = fingerprint(state, primaryId),
        layout = createLayoutIntelligence({
          projectId: req.params.projectId,
          creativeDirection: state.creative,
          brandIntelligence: state.brand,
          referenceIntelligence: state.reference,
          format: primaryId,
          formatContext: { platform: "meta", usage: "advertising" },
          destinationTool: state.workspace?.destinationTool ?? "Canva",
        }),
        primary = layout.layoutDocument?.frames[0];
      if (!primary)
        return res
          .status(422)
          .json({ error: "Primary campaign layout could not be solved." });
      const result = await ensureCampaignVariantFamily(
        {
          projectId: req.params.projectId,
          operationId: String(operationId),
          inputFingerprint,
          expectedProjectRevision: Number(expectedRevision),
          invariants: state.invariants,
          primaryLayout: primary,
          route: state.creative.selectedRoute!,
          brand: state.brand?.brandDNA,
          primaryFormatId: primaryId,
          estimatedCostUsd: 0.58,
          hardCapUsd: 0.75,
        },
        { repository: applicationCampaignFamilyRepository },
      );
      return res.status(result.cacheHit ? 200 : 201).json(safe(result));
    } catch (error) {
      const conflict =
        error instanceof Error && /conflict/i.test(error.message);
      return res.status(conflict ? 409 : 503).json({
        error: conflict
          ? "Campaign concurrency conflict."
          : "Campaign family could not be persisted.",
      });
    }
  });
  router.post("/:projectId/campaign-family/:familyId/run", async (req, res) => {
    try {
      let family = await applicationCampaignFamilyRepository.get(
        req.params.projectId,
        req.params.familyId,
      );
      if (!family)
        return res.status(404).json({ error: "Campaign family not found." });
      if (family.status === "approved")
        return res.json({ family: safe(family), cacheHit: true });
      if (
        family.status === "running" &&
        Date.now() - Date.parse(family.updatedAt) < 10 * 60_000
      )
        return res
          .status(409)
          .json({ error: "Campaign family execution is already running." });
      const state = await shared(req.params.projectId),
        current = fingerprint(state, family.primaryFormatId);
      if (current !== family.inputFingerprint) {
        family = await applicationCampaignFamilyRepository.save(
          {
            ...family,
            status: "stale",
            variants: family.variants.map((v) =>
              v.status === "approved" ? v : { ...v, status: "stale" },
            ),
            warnings: [
              ...family.warnings,
              "campaign_upstream_revision_required",
            ],
            updatedAt: new Date().toISOString(),
          },
          family.revision,
        );
        return res.status(409).json({
          error: "campaign_upstream_revision_required",
          family: safe(family),
        });
      }
      const targets = family.variants.filter((v) => v.status !== "approved"),
        budget = await preflight(
          family.projectId,
          targets.length,
          false,
          state,
          family,
        );
      if (!budget.allowed)
        return res.status(402).json({
          error: "Campaign mandatory budget preflight failed.",
          budget,
        });
      family = await applicationCampaignFamilyRepository.save(
        { ...family, status: "running", updatedAt: new Date().toISOString() },
        family.revision,
      );
      const source = await resolveProjectSourceRegistry(
          family.projectId,
          state.assets
            .filter((x) => x.role !== "visual_reference")
            .map((x) => x.assetId),
          applicationProjectSourceAssetRepository,
          applicationProjectSourceAssetStore,
        ),
        result = await runCampaignFamily(
          {
            family,
            currentFamilyFingerprint: current,
            creative: state.creative,
            brand: state.brand,
            reference: state.reference,
            sourceRegistry: source.registry,
          },
          {
            repository: applicationCampaignFamilyRepository,
            engines: await createCampaignRuntimeAdapters(),
          },
        );
      return res.json({
        family: safe(result.family),
        authority: result.authority ? safe(result.authority) : undefined,
        budget,
      });
    } catch (error) {
      return res
        .status(
          error instanceof Error &&
            /revision|conflict|running/.test(error.message)
            ? 409
            : 503,
        )
        .json({
          error:
            error instanceof Error &&
            error.message === "campaign_upstream_revision_required"
              ? error.message
              : "Campaign execution failed safely.",
        });
    }
  });
  router.post(
    "/:projectId/campaign-family/:familyId/variants/:formatId/retry",
    async (req, res) => {
      try {
        let family = await applicationCampaignFamilyRepository.get(
          req.params.projectId,
          req.params.familyId,
        );
        if (!family)
          return res.status(404).json({ error: "Campaign family not found." });
        if (family.warnings.includes("campaign_upstream_revision_required"))
          return res
            .status(409)
            .json({ error: "campaign_upstream_revision_required" });
        const target = family.variants.find(
          (x) => x.formatId === req.params.formatId,
        );
        if (!target)
          return res.status(404).json({ error: "Campaign variant not found." });
        if (target.status === "approved")
          return res.json({ family: safe(family), cacheHit: true });
        const state = await shared(req.params.projectId),
          current = fingerprint(state, family.primaryFormatId);
        if (current !== family.inputFingerprint) {
          family = await applicationCampaignFamilyRepository.save(
            {
              ...family,
              status: "stale",
              warnings: [
                ...family.warnings,
                "campaign_upstream_revision_required",
              ],
              updatedAt: new Date().toISOString(),
            },
            family.revision,
          );
          return res.status(409).json({
            error: "campaign_upstream_revision_required",
            family: safe(family),
          });
        }
        const budget = await preflight(
          family.projectId,
          1,
          true,
          state,
          family,
        );
        if (!budget.allowed)
          return res
            .status(402)
            .json({ error: "Variant retry budget preflight failed.", budget });
        family = await applicationCampaignFamilyRepository.save(
          { ...family, status: "running", updatedAt: new Date().toISOString() },
          family.revision,
        );
        const source = await resolveProjectSourceRegistry(
            family.projectId,
            state.assets
              .filter((x) => x.role !== "visual_reference")
              .map((x) => x.assetId),
            applicationProjectSourceAssetRepository,
            applicationProjectSourceAssetStore,
          ),
          result = await runCampaignFamily(
            {
              family,
              currentFamilyFingerprint: current,
              creative: state.creative,
              brand: state.brand,
              reference: state.reference,
              sourceRegistry: source.registry,
              onlyFormatId: req.params.formatId,
            },
            {
              repository: applicationCampaignFamilyRepository,
              engines: await createCampaignRuntimeAdapters(),
            },
          );
        return res.json({
          family: safe(result.family),
          authority: result.authority ? safe(result.authority) : undefined,
          budget,
        });
      } catch (error) {
        return res
          .status(503)
          .json({ error: "Campaign variant retry failed safely." });
      }
    },
  );
  router.get("/:projectId/campaign-family/latest", async (req, res) => {
    try {
      const family = await applicationCampaignFamilyRepository.latest(
        req.params.projectId,
      );
      return family
        ? res.json({ family: safe(family) })
        : res.status(404).json({ error: "Campaign family not found." });
    } catch {
      return res
        .status(503)
        .json({ error: "Campaign persistence unavailable." });
    }
  });
  router.get("/:projectId/campaign-family/:familyId", async (req, res) => {
    try {
      const family = await applicationCampaignFamilyRepository.get(
        req.params.projectId,
        req.params.familyId,
      );
      return family
        ? res.json({
            family: safe(family),
            debug:
              req.query.debug === "campaign"
                ? {
                    familyId: family.familyId,
                    inputFingerprint: family.inputFingerprint,
                    primaryFormatId: family.primaryFormatId,
                    variants: family.variants.map((v) => ({
                      variantId: v.variantId,
                      formatId: v.formatId,
                      status: v.status,
                      layoutSessionId: v.layoutSessionId,
                      renderSessionId: v.renderSessionId,
                      qaSessionId: v.postRenderReviewSessionId,
                      authorityId: v.productionAuthorityId,
                    })),
                    budgetEstimate: family.executionPlan.estimatedCostUsd,
                    missingVariants: family.approval.missingFormatIds,
                  }
                : undefined,
          })
        : res.status(404).json({ error: "Campaign family not found." });
    } catch {
      return res
        .status(503)
        .json({ error: "Campaign persistence unavailable." });
    }
  });
  router.post(
    "/:projectId/campaign-family/:familyId/export",
    async (req, res) => {
      try {
        const family = await applicationCampaignFamilyRepository.get(
          req.params.projectId,
          req.params.familyId,
        );
        if (!family)
          return res.status(404).json({ error: "Campaign family not found." });
        if (
          !family.approval.metaAdsPackageReady ||
          !family.approval.familyAuthorityId
        )
          return res.status(409).json({
            error:
              "All four variant authorities are required for Meta Ads export.",
          });
        const authority =
          await applicationCampaignFamilyRepository.getAuthority(
            req.params.projectId,
            family.approval.familyAuthorityId,
          );
        if (!authority)
          return res
            .status(409)
            .json({ error: "Campaign family authority is unavailable." });
        const result = await createCampaignFamilyExport(
          {
            family,
            authority,
            projectSlug:
              typeof req.body?.projectSlug === "string"
                ? req.body.projectSlug
                : undefined,
          },
          {
            projects: applicationProjectRepository,
            repository: applicationCampaignFamilyRepository,
            assetStore: applicationGeneratedAssetStore,
            artifactStore: applicationProductionArtifactStore,
          },
        );
        return res.json(safe(result));
      } catch {
        return res.status(503).json({
          error: "Campaign family export is temporarily unavailable.",
        });
      }
    },
  );
  router.post(
    "/:projectId/campaign-family/:familyId/exports/:exportSessionId/read-handle",
    async (req, res) => {
      try {
        const session = await applicationCampaignFamilyRepository.getExport(
          req.params.projectId,
          req.params.exportSessionId,
        );
        if (!session || session.familyId !== req.params.familyId)
          return res.status(404).json({ error: "Campaign export not found." });
        if (
          !(await applicationProductionArtifactStore.exists(
            session.artifact.backingRef,
            session.projectId,
          ))
        ) {
          await applicationCampaignFamilyRepository.saveExport({
            ...session,
            status: "unavailable",
            artifact: { ...session.artifact, status: "unavailable" },
          });
          return res.status(409).json({
            error: "Campaign package is unavailable and can be re-exported.",
          });
        }
        if (applicationProductionArtifactStore.kind === "memory")
          return res.json({
            url: `/api/projects/${encodeURIComponent(session.projectId)}/campaign-family/${encodeURIComponent(session.familyId)}/exports/${encodeURIComponent(session.exportSessionId)}/download`,
            filename: session.artifact.filename,
            mediaType: session.artifact.mediaType,
          });
        if (!applicationProductionArtifactStore.createReadHandle)
          return res
            .status(503)
            .json({ error: "Private download unavailable." });
        return res.json(
          await applicationProductionArtifactStore.createReadHandle(
            session.artifact.backingRef,
            session.projectId,
            session.artifact.mediaType,
            session.artifact.filename,
            300,
          ),
        );
      } catch {
        return res
          .status(503)
          .json({ error: "Campaign package is temporarily unavailable." });
      }
    },
  );
  router.get(
    "/:projectId/campaign-family/:familyId/exports/:exportSessionId/download",
    async (req, res) => {
      try {
        const session = await applicationCampaignFamilyRepository.getExport(
          req.params.projectId,
          req.params.exportSessionId,
        );
        if (!session || session.familyId !== req.params.familyId)
          return res.status(404).end();
        const bytes = await applicationProductionArtifactStore.get(
          session.artifact.backingRef,
          session.projectId,
        );
        if (!bytes) return res.status(404).end();
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${session.artifact.filename.replace(/["\\\r\n]/g, "")}"`,
        );
        return res.send(Buffer.from(bytes));
      } catch {
        return res.status(404).end();
      }
    },
  );
  return router;
};
