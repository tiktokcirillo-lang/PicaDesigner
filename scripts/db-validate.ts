import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql = await readFile(
  new URL("../migrations/001_durable_project_authority.sql", import.meta.url),
  "utf8",
);
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
console.log(
  "DB schema validation passed: durable tables, idempotency indexes and metadata-only storage; no Neon mutation executed.",
);
