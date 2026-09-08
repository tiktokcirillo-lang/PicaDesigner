# Durable generated asset storage

Production generated media is stored in Vercel Private Blob through `VercelBlobGeneratedAssetStore`. The factory selects Blob when Vercel provides `VERCEL_OIDC_TOKEN` plus `BLOB_STORE_ID`, or the officially supported static `BLOB_READ_WRITE_TOKEN`. OIDC is preferred. If production has no durable store, generation fails before the provider call; memory fallback requires an explicit override.

Objects use immutable content-addressed paths: `projects/{projectId}/generated/{sha256}.{ext}`. Persisted references use `blob-private://{projectId}/{sha256}.{ext}` and are parsed with strict project isolation. Upstash remains budget-only; image bytes never enter Redis.

Vercel setup: Project → Storage → create/connect Blob → Private. Use the automatically provisioned OIDC/store variables where available. No Blob credential belongs in a `VITE_` variable.
