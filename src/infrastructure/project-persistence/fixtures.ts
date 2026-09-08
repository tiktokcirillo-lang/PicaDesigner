import { createHash } from "node:crypto";
import type {
  GeneratedImageAsset,
  ImageAssetSession,
} from "../../domain/image-assets/index.js";
import type {
  PostRenderReviewSession,
  VisualApprovedRenderPackage,
} from "../../domain/post-render-review/index.js";
import type { ProductionExportSession } from "../../domain/export-engine/index.js";
export const persistenceFixtures = (
  backingRef = "blob-private://projects/p/assets/active.png",
) => {
  const bytes = Uint8Array.from([137, 80, 78, 71]),
    checksum = createHash("sha256").update(bytes).digest("hex"),
    asset = {
      id: "asset-active",
      source: "generated",
      type: "generated_image",
      mediaType: "image/png",
      width: 1080,
      height: 1080,
      fingerprint: "asset-fp",
      status: "available",
      provenance: [],
      backingRef,
      checksum,
      requirementId: "hero",
      model: "mock",
      quality: "standard",
      createdAt: "2026-01-01T00:00:00.000Z",
    } as GeneratedImageAsset,
    imageSession = {
      activeGeneratedAssets: [asset],
      historicalGeneratedAssets: [
        {
          ...asset,
          id: "asset-old",
          backingRef: "blob-private://old",
          checksum: "old",
        },
      ],
      generatedAssets: [asset],
    } as unknown as ImageAssetSession,
    pkg = {
      projectId: "p",
      reviewSessionId: "review",
      postRenderReviewSessionId: "qa",
      renderSession: { sessionId: "render" },
      generatedAssetSession: imageSession,
      visualApprovalStatus: "approved",
      pixelQaSummary: { score: 95, verdict: "approved" },
    } as unknown as VisualApprovedRenderPackage,
    post = {
      schemaVersion: "1.0.0",
      sessionId: "qa",
      projectId: "p",
      visualApproved: true,
      approvedPackage: pkg,
    } as unknown as PostRenderReviewSession,
    exportSession = {
      schemaVersion: "1.0.0",
      sessionId: "export-1",
      projectId: "p",
      createdAt: "2026-01-01T00:00:00.000Z",
      inputFingerprint: "export-fp",
      profile: "social_png",
      artifacts: [
        {
          artifactId: "artifact-1",
          projectId: "p",
          format: "png",
          filename: "p.png",
          mediaType: "image/png",
          checksum: "artifact-checksum",
          byteSize: 10,
          backingRef: "export-blob://projects/p/exports/fp/p.png",
          source: {
            visualApprovedPackageFingerprint: "authority-fp",
            renderSessionId: "render",
            canonicalArtifactChecksum: "svg",
          },
          status: "ready",
          warnings: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          retentionClass: "standard",
        },
      ],
      status: "ready",
      warnings: [],
      cost: { aiUsd: 0 },
      sourceVersions: {},
      cacheHit: false,
      storageKind: "durable",
    } as ProductionExportSession;
  return { bytes, checksum, asset, pkg, post, exportSession };
};
