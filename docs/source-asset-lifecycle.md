# Source asset lifecycle

1. Browser calculates SHA-256 and asks for a scoped upload authorization.
2. Bytes go directly to Private Blob (or explicit development memory storage).
3. Server finalization re-opens and validates bytes, then records metadata in Neon.
4. Workspace stores canonical asset IDs in durable checkpoints.
5. Server pipelines resolve IDs and active metadata after every cold start.
6. A replacement supersedes the old metadata record; history remains available but is not an automatic fallback.
7. Missing/corrupt Blob backing changes effective status to unavailable/invalid and blocks rendering or analysis.
