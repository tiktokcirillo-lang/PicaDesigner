# Durable project source assets

Project source assets are private user-supplied images with five canonical roles: `visual_reference`, `official_logo`, `product_image`, `brand_photo`, and `graphic_asset`. They are a separate lifecycle from generated images and export artifacts.

## Storage and security boundary

Bytes are content-addressed by SHA-256 in Vercel Private Blob under `projects/{projectId}/source-assets/{checksum}.{ext}`. Neon stores only metadata, lineage, dimensions, checksum and the opaque `backingRef`; migration `003_project_source_assets.sql` contains no binary or base64 column. Production fails closed if durable storage is unavailable. The browser receives safe summaries and temporary read handles, never Blob credentials or `backingRef` values.

Uploads use the Vercel client-upload handshake. The server issues a short-lived token scoped to one project pathname, supported MIME types and the configured size limit. Finalization derives the backing reference from project ID, checksum and detected format; it does not accept an arbitrary reference from the browser. JPEG, PNG and WebP are decoded with Sharp, MIME is checked against bytes, dimensions and pixel count are bounded, and SVG is rejected.

## Cold start and restore

Workspace checkpoints persist source asset IDs only. On restore, the server-owned metadata list rebuilds UI selections without IndexedDB or base64. A new repository/store instance can resolve the same Neon metadata and Blob object. Missing or checksum-invalid backing data marks the asset unavailable and blocks its use; historical assets are not silently substituted.

## Renderer and Visual Forensics

`visual_reference` is resolved server-side and converted to provider input only for Visual Forensics. It is intentionally excluded from the renderer registry. Logo, product, brand-photo and graphic assets become renderer assets with explicit source-role provenance. Browser requests carry IDs; each server stage rehydrates private refs from the repository and strips them before returning JSON.

Run `npm run source-assets:validation` for MIME, size, isolation, idempotency, cold-start, provenance and missing-backing coverage. Automated validation uses mock durable backends and makes no Blob, Neon, or OpenAI calls.
