# Source asset storage operations

Apply `migrations/003_project_source_assets.sql` to Neon before enabling the feature in production. Configure a Vercel Private Blob store through the platform integration (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`, or its server-only read/write token). No migration is run automatically by the application.

Health is available at `GET /api/health/source-asset-store` and reveals capability/status only. A degraded result in production blocks upload/finalization. Orphan cleanup and retention are intentionally deferred; content-addressed objects should be deleted only after confirming that no active or historical metadata references them.
