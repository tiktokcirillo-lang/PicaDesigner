# Project workspace state

The initial state always comes from GET /api/projects/:projectId/state. serverSnapshot is read-only, while draft holds local edits. Workspace input metadata is autosaved after a 1000 ms debounce with an operation fingerprint and expected revision. A 409 response stops the write and offers an explicit server reload; no silent merge occurs.

Reference bytes remain session-local and are not written to Neon. Checkpoints contain metadata and structured pipeline results. IndexedDB is not required for restore. Legacy browser data is not granted approval or production authority.
