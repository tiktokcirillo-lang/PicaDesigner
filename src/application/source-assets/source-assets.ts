import { createHash } from "node:crypto";
import {
  SOURCE_ASSET_SCHEMA_VERSION,
  buildProjectSourceAssetRegistry,
  safeOriginalFilename,
  safeSourceAssetSummary,
  sourceExtension,
  createProjectSourceAssetRef,
  validateProjectSourceImage,
  type ProjectSourceAsset,
  type ProjectSourceAssetRepository,
  type ProjectSourceAssetRole,
  type ProjectSourceAssetStore,
  type SourceAssetUploadCheck,
} from "../../domain/source-assets/index.js";
import type { ProjectAssetRegistry } from "../../domain/render-engine/index.js";
export async function checkProjectSourceAssetUpload(
  input: {
    projectId: string;
    role: ProjectSourceAssetRole;
    mediaType: string;
    byteSize: number;
    checksum: string;
  },
  deps: {
    repository: ProjectSourceAssetRepository;
    store: ProjectSourceAssetStore;
    maxBytes: number;
    maxPixels: number;
  },
): Promise<SourceAssetUploadCheck> {
  const extension = sourceExtension(input.mediaType);
  if (!extension) throw new Error("Unsupported source media type.");
  const existing = await deps.repository.findByChecksum(
    input.projectId,
    input.checksum,
    input.role,
  );
  if (existing?.status === "available") {
    if (
      existing.mediaType !== input.mediaType ||
      existing.byteSize !== input.byteSize
    )
      throw new Error("Source asset metadata mismatch.");
    const bytes = await deps.store.get(existing.backingRef, input.projectId);
    if (!bytes) throw new Error("Source backing unavailable.");
    await validateProjectSourceImage({
      bytes,
      declaredMediaType: input.mediaType,
      role: input.role,
      expectedChecksum: input.checksum,
      maxBytes: deps.maxBytes,
      maxPixels: deps.maxPixels,
    });
    return {
      reusable: true,
      uploadRequired: false,
      storeKind: deps.store.kind,
      asset: safeSourceAssetSummary(existing),
      recovery: "metadata",
    };
  }
  const ref = createProjectSourceAssetRef(
      input.projectId,
      input.checksum,
      extension,
    ),
    backingExists = await deps.store.exists(ref, input.projectId);
  if (!backingExists)
    return {
      reusable: false,
      uploadRequired: true,
      storeKind: deps.store.kind,
    };
  const bytes = await deps.store.get(ref, input.projectId);
  if (!bytes) throw new Error("Source backing unavailable.");
  if (bytes.byteLength !== input.byteSize)
    throw new Error("Source backing size mismatch.");
  await validateProjectSourceImage({
    bytes,
    declaredMediaType: input.mediaType,
    role: input.role,
    expectedChecksum: input.checksum,
    maxBytes: deps.maxBytes,
    maxPixels: deps.maxPixels,
  });
  return {
    reusable: true,
    uploadRequired: false,
    storeKind: deps.store.kind,
    recovery: "orphan_backing",
  };
}
export async function finalizeProjectSourceAsset(
  input: {
    projectId: string;
    role: ProjectSourceAssetRole;
    operationId: string;
    originalFilename: string;
    mediaType: string;
    byteSize: number;
    checksum: string;
    supersedesAssetId?: string;
  },
  deps: {
    repository: ProjectSourceAssetRepository;
    store: ProjectSourceAssetStore;
    maxBytes: number;
    maxPixels: number;
  },
) {
  const extension = sourceExtension(input.mediaType);
  if (!extension) throw new Error("Unsupported source media type.");
  const ref = createProjectSourceAssetRef(
      input.projectId,
      input.checksum,
      extension,
    ),
    bytes = await deps.store.get(ref, input.projectId);
  if (!bytes) throw new Error("Uploaded source backing was not found.");
  const inspected = await validateProjectSourceImage({
    bytes,
    declaredMediaType: input.mediaType,
    role: input.role,
    expectedChecksum: input.checksum,
    maxBytes: deps.maxBytes,
    maxPixels: deps.maxPixels,
  });
  if (bytes.byteLength !== input.byteSize)
    throw new Error("Uploaded source size mismatch.");
  const existing = await deps.repository.findByChecksum(
    input.projectId,
    inspected.checksum,
    input.role,
  );
  if (existing && existing.status === "available")
    return safeSourceAssetSummary(existing);
  const now = new Date().toISOString(),
    asset: ProjectSourceAsset = {
      schemaVersion: SOURCE_ASSET_SCHEMA_VERSION,
      assetId:
        existing?.assetId ??
        `source_${input.role}_${inspected.checksum.slice(0, 24)}`,
      projectId: input.projectId,
      operationId: existing?.operationId ?? input.operationId,
      role: input.role,
      originalFilename: safeOriginalFilename(input.originalFilename),
      mediaType: inspected.mediaType,
      byteSize: bytes.byteLength,
      width: inspected.width,
      height: inspected.height,
      aspectRatio: inspected.aspectRatio,
      checksum: inspected.checksum,
      backingRef: ref,
      status: "available",
      supersedesAssetId: input.supersedesAssetId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: {
        hasAlpha: inspected.hasAlpha,
        warning:
          input.role === "official_logo" && inspected.mediaType === "image/jpeg"
            ? "JPEG logos do not preserve transparency."
            : undefined,
      },
    };
  const saved = await deps.repository.save(asset);
  if (input.supersedesAssetId && input.supersedesAssetId !== saved.assetId)
    await deps.repository.markSuperseded(
      input.projectId,
      input.supersedesAssetId,
      saved.assetId,
    );
  return safeSourceAssetSummary(saved);
}
export async function reconcileProjectSourceAsset(
  asset: ProjectSourceAsset,
  store: ProjectSourceAssetStore,
) {
  try {
    const bytes = await store.get(asset.backingRef, asset.projectId);
    if (!bytes) return { ...asset, status: "unavailable" as const };
    const checksum = createHash("sha256").update(bytes).digest("hex");
    return checksum === asset.checksum
      ? asset
      : { ...asset, status: "invalid" as const };
  } catch {
    return { ...asset, status: "invalid" as const };
  }
}
export async function resolveProjectSourceRegistry(
  projectId: string,
  assetIds: string[],
  repository: ProjectSourceAssetRepository,
  store: ProjectSourceAssetStore,
) {
  const assets: ProjectSourceAsset[] = [];
  for (const assetId of [...new Set(assetIds)]) {
    const asset = await repository.get(projectId, assetId);
    if (!asset)
      throw new Error("Source asset does not belong to this project.");
    const effective = await reconcileProjectSourceAsset(asset, store);
    if (effective.status !== "available")
      await repository.markUnavailable(projectId, assetId);
    assets.push(effective);
  }
  return buildProjectSourceAssetRegistry(projectId, assets);
}
export async function hydrateProjectAssetRegistry(
  projectId: string,
  registry: ProjectAssetRegistry,
  repository: ProjectSourceAssetRepository,
  store: ProjectSourceAssetStore,
) {
  const sourceIds = registry.assets
      .filter((a) => a.provenance.includes("project_source_asset"))
      .map((a) => a.id),
    source = await resolveProjectSourceRegistry(
      projectId,
      sourceIds,
      repository,
      store,
    );
  const byId = new Map(source.registry.assets.map((a) => [a.id, a]));
  return {
    projectId,
    assets: registry.assets.map((asset) => byId.get(asset.id) ?? asset),
  };
}
