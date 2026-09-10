import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
const html = readFileSync(
  new URL("../src/ui/formats/FormatSelector.tsx", import.meta.url),
  "utf8",
);
const ids = [
  "meta_ads_square",
  "meta_ads_feed_portrait",
  "meta_ads_story_reels",
  "meta_ads_landscape",
];
for (const [index, id] of ids.entries())
  assert(html.includes(`"${id}"`), String.fromCharCode(65 + index));
assert(html.includes('label: "Meta Ads"'), "Meta group");
const logic = readFileSync(
  new URL("../src/ui/state/workspace-logic.ts", import.meta.url),
  "utf8",
);
assert(logic.includes('id.startsWith("meta_ads_")'), "F format context");
for (const legacy of [
  "Apresentação (16:9 - 1920x1080)",
  "Carrossel Vertical (1080x1350)",
  "Post Estático Quadrado (1080x1080)",
  "LinkedIn Banner (1584x396)",
  "Twitter Header (1500x500)",
])
  assert(html.includes(`"${legacy}"`), "G legacy format");
const workspace = readFileSync(
  new URL("../src/ui/workspace/ProjectWorkspace.tsx", import.meta.url),
  "utf8",
);
assert(workspace.includes("restoredDraft"), "H save/restore");
assert(
  html.includes('formatId:"meta_ads_family"'),
  "campaign package UI must expose the canonical family ID",
);
console.log(
  "Format selector validation passed: canonical Meta values, context, legacy and save/restore A-H.",
);
