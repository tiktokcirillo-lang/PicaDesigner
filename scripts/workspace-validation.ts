import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FORMAT_REGISTRY } from "../src/domain/layout-engine/formats.js";
const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8"),
  [index, app, projects, preview, workspace] = await Promise.all([
    read("../index.html"),
    read("../src/App.tsx"),
    read("../src/server/api/projects.ts"),
    read("../src/server/api/preview.ts"),
    read("../src/ui/workspace/ProjectWorkspace.tsx"),
  ]);
assert(index.length < 5000, "index.html must remain a minimal bootstrap");
assert(!/onclick=|onchange=|window\.generate|indexedDB/i.test(index));
assert(
  app.includes("ProjectDashboard") &&
    app.includes("ProjectWorkspace") &&
    app.includes("ProjectHistory"),
);
assert(projects.includes("expectedRevision") && projects.includes("history"));
assert(
  preview.includes("applicationGeneratedAssetStore") &&
    !preview.includes("req.body"),
);
assert(!workspace.includes("visualApprovedPackage"));
for (const id of [
  "meta_ads_square",
  "meta_ads_feed_portrait",
  "meta_ads_story_reels",
  "meta_ads_landscape",
])
  assert(FORMAT_REGISTRY[id]);
console.log(
  "Workspace validation passed: minimal bootstrap, React routes, canonical formats, server authority and safe preview.",
);
