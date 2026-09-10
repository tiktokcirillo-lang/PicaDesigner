import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql = await readFile(
  new URL("../migrations/001_durable_project_authority.sql", import.meta.url),
  "utf8",
);
const workspaceSql=await readFile(new URL("../migrations/002_workspace_project_metadata.sql",import.meta.url),"utf8");
const sourceSql=await readFile(new URL("../migrations/003_project_source_assets.sql",import.meta.url),"utf8");
const campaignSql=await readFile(new URL("../migrations/004_campaign_variant_families.sql",import.meta.url),"utf8");
const exportApi=await readFile(new URL('../src/server/api/exports.ts',import.meta.url),'utf8'),factory=await readFile(new URL('../src/infrastructure/project-persistence/factory.ts',import.meta.url),'utf8');
for (const table of [
  "projects",
  "project_versions",
  "workflow_checkpoints",
  "production_authorities",
  "production_export_sessions",
])
  assert(sql.includes(`TABLE IF NOT EXISTS ${table}`));
assert(!/\bbytea\b|base64/i.test(sql));
assert(/UNIQUE\(project_id, operation_id\)/.test(sql));
assert(exportApi.includes('"visualApprovedPackage" in (req.body ?? {})'));
assert(!exportApi.includes('?? body.visualApprovedPackage'));
assert(/if\s*\(env\.DATABASE_URL\)/.test(factory));
assert(factory.includes('!production'));
assert(workspaceSql.includes("ADD COLUMN IF NOT EXISTS name text"));
assert(workspaceSql.includes("SET NOT NULL"));
assert(sourceSql.includes("TABLE IF NOT EXISTS project_source_assets"));
assert(/UNIQUE\s*\(project_id,\s*operation_id\)/.test(sourceSql));
assert(!/\bbytea\b|base64/i.test(sourceSql));
for(const table of ["campaign_variant_families","campaign_variants","campaign_family_authorities","campaign_family_export_sessions"])assert(campaignSql.includes(`TABLE IF NOT EXISTS ${table}`));
assert(campaignSql.includes("latest_campaign_family_authority_id"));assert(!/\bbytea\b|base64/i.test(campaignSql));
console.log(
  "DB schema validation passed: durable tables, idempotency indexes and metadata-only storage; no Neon mutation executed.",
);
