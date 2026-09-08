# Export security

Production artifacts use a dedicated private `ProductionArtifactStore`. In production, Vercel Private Blob is selected when configured; signed download URLs are temporary and never persisted in export sessions. Local development may use the non-persistent memory store.

Filenames and ZIP entries reject traversal, absolute paths, control characters and extension injection. SVG derivatives reject scripts, event handlers, `foreignObject`, external URLs and unresolved `asset://` references. Raster output is decoded after encoding to validate media type and exact dimensions. Every artifact and package receives SHA-256.
