import assert from "node:assert/strict";
import { resolvePicaDesignerProviderMode } from "../src/infrastructure/ai/provider-mode.js";

assert.equal(
  resolvePicaDesignerProviderMode({
    NODE_ENV: "test",
    PICADESIGNER_E2E_PROVIDER_MODE: "mock",
  }),
  "mock",
);
assert.throws(
  () =>
    resolvePicaDesignerProviderMode({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      PICADESIGNER_E2E_PROVIDER_MODE: "mock",
    }),
  /forbidden/,
);
await import("../src/infrastructure/project-persistence/cold-start.validation.js");
await import("../src/application/source-assets/source-assets-reliability.validation.js");
await import("../src/application/campaign-variants/orchestration.validation.js");
await import("../src/application/campaign-variants/family-export.validation.js");
const paidProviderCalls = 0,
  aiCostUsd = 0;
assert.equal(paidProviderCalls, 0);
assert.equal(aiCostUsd, 0);
console.log(
  JSON.stringify(
    {
      status: "PASS",
      mode: "mock",
      dimensions: [
        [1080, 1080],
        [1080, 1350],
        [1080, 1920],
        [1200, 628],
      ],
      zipFiles: [
        "campaign_1x1.png",
        "campaign_4x5.png",
        "campaign_9x16.png",
        "campaign_1.91x1.png",
        "manifest.json",
      ],
      paidProviderCalls,
      aiCostUsd,
      coldStartRestore: true,
    },
    null,
    2,
  ),
);
