# Private asset delivery

`POST /api/assets/read-handle` accepts project, asset ID and image-session lineage, resolves server-owned metadata and issues a five-minute private Blob GET URL. It never accepts raw pathnames or external URLs. Signed URLs are ephemeral and are not saved in project state.

Canonical SVG retains `asset://assetId`. `materializeSvgAssets()` creates an ephemeral preview/QA SVG with read handles while preserving the canonical checksum. This phase provides project/session lineage isolation, not a substitute for future account authorization.
