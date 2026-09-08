# Durable project and production authority persistence

Neon Postgres is the production source of truth for projects, optimistic revisions, workflow checkpoints, visual production authorities, active asset resolutions and export-session metadata. Vercel Private Blob stores generated images and export binaries; Upstash Redis remains responsible for AI budget reservations. Browser IndexedDB is only a disposable cache.

Production fails closed when `DATABASE_URL` is absent. In-memory repositories are available only outside production for tests and explicit development. The server records visual approval before returning a successful final QA response. Export creation resolves the latest authority from the repository and rejects any request containing a browser-supplied `visualApprovedPackage`.

Every mutable project write carries `expectedRevision`; stale writes return conflict instead of overwriting newer state. `operationId` and fingerprints enforce idempotency. Postgres JSON metadata is checked to reject binary arrays, image/PDF/ZIP base64, secrets, raw prompts and hidden reasoning. Only private `backingRef`, checksum and safe metadata are stored.

`GET /api/projects/:projectId/state` reconstructs workflow state, active production authority metadata, active asset resolutions and exports after a cold start. Signed Blob URLs are generated only on demand and are never persisted.
