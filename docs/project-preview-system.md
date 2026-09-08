# Project preview system

GET /api/projects/:projectId/preview resolves the current production authority or render checkpoint server-side. It materializes active private assets, rasterizes the canonical SVG with Resvg and returns a reduced PNG with an ETag and private cache policy.

The endpoint rejects client SVG and backing references. Preview refresh has no AI cost, creates no export artifact and never replaces export authority. Safe-area and grid overlays are CSS-only workspace aids.
