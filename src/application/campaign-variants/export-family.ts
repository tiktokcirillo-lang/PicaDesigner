import { createHash } from "node:crypto";
import {
  campaignFingerprint,
  type CampaignFamilyAuthority,
  type CampaignFamilyExportSession,
  type CampaignFamilyRepository,
  type CampaignVariantFamily,
} from "../../domain/campaign-variants/index.js";
import { META_ADS_FAMILY } from "../../domain/layout-engine/index.js";
import type { GeneratedAssetStore } from "../../domain/image-assets/index.js";
import type { ProjectPersistenceRepository } from "../../domain/project-persistence/index.js";
import { sanitizeFilenamePart } from "../../domain/export-engine/index.js";
import {
  buildProductionZip,
  NodeProductionRasterEncoder,
  SafeSelfContainedSvgExporter,
  type ProductionArtifactStore,
} from "../../infrastructure/export-engine/index.js";
import { createProductionExport } from "../export-engine/index.js";

const suffix: Record<string, string> = {
  meta_ads_square: "1x1",
  meta_ads_feed_portrait: "4x5",
  meta_ads_story_reels: "9x16",
  meta_ads_landscape: "1.91x1",
};
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export async function createCampaignFamilyExport(
  input: {
    family: CampaignVariantFamily;
    authority: CampaignFamilyAuthority;
    projectSlug?: string;
    operationId?: string;
  },
  deps: {
    projects: ProjectPersistenceRepository;
    repository: CampaignFamilyRepository;
    assetStore: GeneratedAssetStore;
    artifactStore: ProductionArtifactStore;
  },
): Promise<CampaignFamilyExportSession> {
  if (
    !input.family.approval.metaAdsPackageReady ||
    input.authority.status !== "valid"
  )
    throw new Error("Complete campaign family authority is required.");
  const slug = sanitizeFilenamePart(input.projectSlug ?? "project"),
    operationId =
      input.operationId ?? `campaign-export:${input.authority.fingerprint}`;
  const prior = (
    await deps.repository.listExports(
      input.family.projectId,
      input.family.familyId,
    )
  ).find((x) => x.operationId === operationId);
  if (
    prior?.status === "ready" &&
    (await deps.artifactStore.exists(
      prior.artifact.backingRef,
      input.family.projectId,
    ))
  )
    return prior;
  const entries: Array<{ path: string; bytes: Uint8Array }> = [],
    variants: Record<string, unknown>[] = [];
  const encoder = new NodeProductionRasterEncoder();
  for (const formatId of META_ADS_FAMILY.variants) {
    const variant = input.family.variants.find((v) => v.formatId === formatId),
      authorityId = input.authority.variantAuthorityIds[formatId];
    if (!variant || !authorityId)
      throw new Error("Campaign variant authority is missing.");
    const authority = await deps.projects.getProductionAuthority(
      input.family.projectId,
      authorityId,
    );
    if (!authority || authority.status !== "valid")
      throw new Error("Campaign variant authority is invalid.");
    const production = await createProductionExport(
      {
        projectId: input.family.projectId,
        visualApprovedPackage: authority.visualApprovedPackage,
        formats: ["png"],
        profile: "meta_ads_package",
        includeManifest: false,
        includeZip: false,
        projectSlug: slug,
      },
      {
        assetStore: deps.assetStore,
        artifactStore: deps.artifactStore,
        rasterEncoder: encoder,
        svgExporter: new SafeSelfContainedSvgExporter(),
      },
    );
    const artifact = production.artifacts.find(
      (a) =>
        a.format === "png" &&
        a.width === variant.width &&
        a.height === variant.height,
    );
    if (!artifact?.backingRef)
      throw new Error("Native variant PNG is unavailable.");
    const bytes = await deps.artifactStore.get(
      artifact.backingRef,
      input.family.projectId,
    );
    if (!bytes) throw new Error("Native variant backing is unavailable.");
    const inspected = await encoder.inspect(bytes);
    if (
      inspected.format !== "png" ||
      inspected.width !== variant.width ||
      inspected.height !== variant.height
    )
      throw new Error("Native variant dimensions are invalid.");
    entries.push({ path: `${slug}_${suffix[formatId]}.png`, bytes });
    variants.push({
      variantId: variant.variantId,
      formatId,
      width: variant.width,
      height: variant.height,
      pngChecksum: sha(bytes),
      productionAuthorityId: authorityId,
      renderSessionId: variant.renderSessionId,
      postRenderReviewSessionId: variant.postRenderReviewSessionId,
      visualApprovalStatus: "approved",
    });
  }
  const manifest = {
    familyId: input.family.familyId,
    familyAuthorityId: input.authority.familyAuthorityId,
    familyFingerprint: input.authority.fingerprint,
    variants,
  };
  entries.push({
    path: "manifest.json",
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  });
  const bytes = buildProductionZip(entries),
    checksum = sha(bytes),
    filename = `${slug}_meta-ads-package.zip`,
    artifactId = `campaign_export_${checksum.slice(0, 20)}`;
  const backingRef = await deps.artifactStore.put({
    projectId: input.family.projectId,
    exportFingerprint: input.authority.fingerprint,
    artifactId,
    filename,
    bytes,
    mediaType: "application/zip",
    checksum,
  });
  const inputFingerprint = campaignFingerprint({
      authority: input.authority.fingerprint,
      files: entries.map((x) => x.path),
      checksums: variants.map((x) => x.pngChecksum),
    }),
    createdAt = new Date().toISOString();
  return deps.repository.saveExport({
    exportSessionId:
      prior?.exportSessionId ??
      `campaign_export_session_${inputFingerprint.slice(0, 24)}`,
    familyId: input.family.familyId,
    familyAuthorityId: input.authority.familyAuthorityId,
    projectId: input.family.projectId,
    operationId,
    inputFingerprint,
    profile: "meta_ads_package",
    artifact: {
      artifactId,
      filename,
      format: "zip",
      mediaType: "application/zip",
      byteSize: bytes.length,
      checksum,
      backingRef,
      status: "available",
    },
    manifest,
    status: "ready",
    createdAt,
  });
}
