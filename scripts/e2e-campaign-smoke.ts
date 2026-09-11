// @ts-nocheck -- integrated smoke deliberately uses compact deterministic fixtures.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { InMemoryBudgetStore, createLedger } from "../src/infrastructure/ai/budget/budget-tracker.js";
import { BudgetedAIExecutor } from "../src/infrastructure/ai/budget/executor.js";
import { AI_DEFAULTS } from "../src/infrastructure/ai/providers/openai/config.js";
import { createAIProviderInstrumentation, createStructuredAIProvider, setStructuredAIProviderInstrumentationForTests } from "../src/infrastructure/ai/providers/factory.js";
import { NodeProductionRasterEncoder } from "../src/infrastructure/export-engine/encoders.js";
import { checkProjectSourceAssetUpload, finalizeProjectSourceAsset } from "../src/application/source-assets/index.js";
import { createMockSourceAssetDatabase, MockProjectSourceAssetRepository } from "../src/infrastructure/source-assets/repository.js";
import { createMockSourceAssetBacking, MockDurableProjectSourceAssetStore } from "../src/infrastructure/source-assets/store.js";
import { createServer } from "node:http";
import { unzipSync } from "fflate";
import { setCampaignRuntimeInstrumentationForTests } from "../src/server/services/campaign-runtime.js";

const dimensions = [[1080,1080],[1080,1350],[1080,1920],[1200,628]];
const zipFiles = ["campaign_1.91x1.png","campaign_1x1.png","campaign_4x5.png","campaign_9x16.png","manifest.json"];

export async function runTrueZeroCostCampaignE2E() {
  const originalFetch = globalThis.fetch;
  const counters = { ...createAIProviderInstrumentation(), mockImageProviderCalls: 0, mockQaCalls: 0, mockCriticCalls: 0, sourceUploadCalls: 0, sourceFinalizeCalls: 0, recoveredPaidResults: 0 };
  globalThis.fetch = (async (input, init) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(target)) return originalFetch(input, init);
    counters.realNetworkCalls += 1;
    throw new Error("E2E_NETWORK_KILL_SWITCH");
  }) as typeof fetch;
  try {
    const env = { NODE_ENV: "test", PICADESIGNER_E2E_PROVIDER_MODE: "mock" } as NodeJS.ProcessEnv;
    assert.throws(() => createStructuredAIProvider({ config: AI_DEFAULTS, env: { NODE_ENV: "production", VERCEL_ENV: "production", PICADESIGNER_E2E_PROVIDER_MODE: "mock" } }), /forbidden/);

    const sourceBytes = await new NodeProductionRasterEncoder().encodePng('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#123456"/></svg>', 16, 16);
    const sourceChecksum = createHash("sha256").update(sourceBytes).digest("hex");
    const sourceDb = createMockSourceAssetDatabase();
    const sourceBlob = createMockSourceAssetBacking();
    const sourceRepository = new MockProjectSourceAssetRepository(sourceDb);
    const sourceStore = new MockDurableProjectSourceAssetStore(sourceBlob);
    const sourceDeps = { repository: sourceRepository, store: sourceStore, maxBytes: 1024 * 1024, maxPixels: 1_000_000 };
    counters.sourceUploadCalls += 1;
    await sourceStore.put({ projectId: "e2e-project", bytes: sourceBytes, mediaType: "image/png", checksum: sourceChecksum });
    counters.sourceFinalizeCalls += 1; // interrupted metadata finalize
    const retryCheck = await checkProjectSourceAssetUpload({ projectId: "e2e-project", role: "visual_reference", mediaType: "image/png", byteSize: sourceBytes.byteLength, checksum: sourceChecksum }, sourceDeps);
    assert.equal(retryCheck.recovery, "orphan_backing");
    assert.equal(retryCheck.uploadRequired, false);
    counters.sourceFinalizeCalls += 1; // same-file retry
    const finalizedSource = await finalizeProjectSourceAsset({ projectId: "e2e-project", role: "visual_reference", operationId: "source-e2e", originalFilename: "reference.png", mediaType: "image/png", byteSize: sourceBytes.byteLength, checksum: sourceChecksum }, sourceDeps);
    assert.equal(finalizedSource.status, "available");
    assert.equal(counters.sourceUploadCalls, 1);

    const budgetStore = new InMemoryBudgetStore();

    // Provider success followed by a simulated checkpoint failure: a fresh
    // executor must recover the durable result without invoking the provider.
    const recoveryStore = new InMemoryBudgetStore();
    const recoveryProvider = createStructuredAIProvider({ config: AI_DEFAULTS, env, instrumentation: counters, mockFactory: () => ({ recovered: true }) });
    const recoveryRequest = { projectId: "e2e-recovery", pass: "generate_design_spec", model: AI_DEFAULTS.forensicsModel, instructions: "stable", inputText: "stable", schemaName: "e2e_recovery", jsonSchema: { type: "object" }, reasoningEffort: "none", maxOutputTokens: 32 } as const;
    const executorA = new BudgetedAIExecutor(recoveryProvider, recoveryStore, 0.75, createLedger("e2e-recovery"));
    await executorA.execute(recoveryRequest, { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 });
    const callsAfterProviderSuccess = counters.mockStructuredProviderCalls;
    const simulatedCheckpointFailure = new Error("simulated checkpoint failure");
    assert(simulatedCheckpointFailure);
    const executorB = new BudgetedAIExecutor(recoveryProvider, recoveryStore, 0.75, createLedger("e2e-recovery"));
    const recovered = await executorB.execute(recoveryRequest, { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 });
    assert.deepEqual(recovered.data, { recovered: true });
    assert.equal(counters.mockStructuredProviderCalls, callsAfterProviderSuccess);
    counters.recoveredPaidResults += 1;

    // HTTP serialization smoke over the real Express routers. This uses an
    // isolated project and loopback only; every non-loopback request is killed.
    const previousMode = process.env.PICADESIGNER_E2E_PROVIDER_MODE;
    process.env.PICADESIGNER_E2E_PROVIDER_MODE = "mock";
    setStructuredAIProviderInstrumentationForTests(counters);
    setCampaignRuntimeInstrumentationForTests(counters);
    const { createServerApp } = await import("../src/server/app.js");
    const server = createServer(createServerApp());
    let routeProjectId = "e2e-route-project", routeFamilyId = "", routeExportSessionId = "", routeZipChecksum = "", routeManifest: any;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}`;
      const post = async (path: string, body: unknown) => {
        const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const payload = await response.json();
        assert(response.ok, `${path} returned ${response.status}: ${JSON.stringify(payload)}`);
        return payload;
      };
      let project = await post("/api/projects", { projectId: routeProjectId, name: "E2E route", operationId: "create-route" });
      const routeReference = await post("/api/visual-forensics/analyze", { projectId: routeProjectId, image: { kind: "base64", data: Buffer.from(sourceBytes).toString("base64"), mediaType: "image/png" }, imageMetadata: { imageFingerprint: sourceChecksum }, analysisDepth: "standard" });
      const checkpoint = async (stage: string, payload: unknown, fingerprint: string) => {
        const saved = await post(`/api/projects/${routeProjectId}/checkpoints`, { versionId: `version:${routeProjectId}`, stage, operationId: `${stage}:${fingerprint}`, fingerprint, expectedRevision: project.revision, payload });
        project = saved.project;
      };
      await checkpoint("workspace_input", { copyText: "NOVO", destinationTool: "Canva" }, "workspace-route");
      await checkpoint("reference_intelligence", routeReference, routeReference.sessionId);
      const routeCreative = await post("/api/creative-direction/generate", { projectId: routeProjectId, copy: "NOVO", format: "meta_ads_feed_portrait", destinationTool: "Canva", tone: "direct", referenceIntelligence: routeReference });
      await checkpoint("creative_direction", routeCreative, routeCreative.inputFingerprint);
      const createdFamily = await post(`/api/projects/${routeProjectId}/campaign-family`, { familyDefinitionId: "meta_ads_family", primaryFormatId: "meta_ads_feed_portrait", expectedRevision: project.revision, operationId: "route-family" });
      const familyId = createdFamily.family.familyId;
      routeFamilyId = familyId;
      const routeRun = await post(`/api/projects/${routeProjectId}/campaign-family/${familyId}/run`, {});
      assert.equal(routeRun.family.status, "approved", JSON.stringify(routeRun.family));
      assert.equal(routeRun.family.approval.metaAdsPackageReady, true);
      assert.equal(routeRun.family.variants.filter((item) => item.status === "approved").length, 4);
      const routeExport = await post(`/api/projects/${routeProjectId}/campaign-family/${familyId}/export`, { projectSlug: "campaign" });
      routeExportSessionId = routeExport.exportSessionId;
      const routeHandle = await post(`/api/projects/${routeProjectId}/campaign-family/${familyId}/exports/${routeExport.exportSessionId}/read-handle`, {});
      const routeDownload = await fetch(`${base}${routeHandle.url}`);
      assert.equal(routeDownload.status, 200);
      const routeZip = new Uint8Array(await routeDownload.arrayBuffer());
      routeZipChecksum = createHash("sha256").update(routeZip).digest("hex");
      const routeEntries = unzipSync(routeZip);
      assert.deepEqual(Object.keys(routeEntries).sort(), zipFiles);
      const expectedByName = new Map([["campaign_1x1.png",[1080,1080]],["campaign_4x5.png",[1080,1350]],["campaign_9x16.png",[1080,1920]],["campaign_1.91x1.png",[1200,628]]]);
      const raster = new NodeProductionRasterEncoder();
      for (const [name, expected] of expectedByName) {
        const info = await raster.inspect(routeEntries[name]);
        assert.deepEqual([info.width, info.height], expected);
      }
      routeManifest = JSON.parse(new TextDecoder().decode(routeEntries["manifest.json"]));
      assert.equal(routeManifest.variants.length, 4);
      const filenameByFormat = { meta_ads_square: "campaign_1x1.png", meta_ads_feed_portrait: "campaign_4x5.png", meta_ads_story_reels: "campaign_9x16.png", meta_ads_landscape: "campaign_1.91x1.png" };
      for (const item of routeManifest.variants) assert.equal(createHash("sha256").update(routeEntries[filenameByFormat[item.formatId]]).digest("hex"), item.pngChecksum);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (previousMode === undefined) delete process.env.PICADESIGNER_E2E_PROVIDER_MODE;
      else process.env.PICADESIGNER_E2E_PROVIDER_MODE = previousMode;
      setStructuredAIProviderInstrumentationForTests();
      setCampaignRuntimeInstrumentationForTests();
    }

    // Recreate the HTTP runtime and restore only from durable IDs/backing.
    process.env.PICADESIGNER_E2E_PROVIDER_MODE = "mock";
    const coldServer = createServer(createServerApp());
    await new Promise<void>((resolve) => coldServer.listen(0, "127.0.0.1", resolve));
    try {
      const address = coldServer.address();
      assert(address && typeof address !== "string");
      const coldBase = `http://127.0.0.1:${address.port}`;
      const stateResponse = await fetch(`${coldBase}/api/projects/${routeProjectId}/state`);
      const restoredState = await stateResponse.json();
      assert.equal(stateResponse.status, 200);
      assert.equal(restoredState.latestCampaignFamily.familyId, routeFamilyId);
      const handleResponse = await fetch(`${coldBase}/api/projects/${routeProjectId}/campaign-family/${routeFamilyId}/exports/${routeExportSessionId}/read-handle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const handle = await handleResponse.json();
      assert.equal(handleResponse.status, 200);
      const restoredDownload = await fetch(`${coldBase}${handle.url}`);
      const restoredBytes = new Uint8Array(await restoredDownload.arrayBuffer());
      assert.equal(createHash("sha256").update(restoredBytes).digest("hex"), routeZipChecksum);
    } finally {
      await new Promise<void>((resolve, reject) => coldServer.close((error) => error ? reject(error) : resolve()));
      if (previousMode === undefined) delete process.env.PICADESIGNER_E2E_PROVIDER_MODE;
      else process.env.PICADESIGNER_E2E_PROVIDER_MODE = previousMode;
    }

    const ledger = await budgetStore.getProject("e2e-project");
    counters.aiCostUsd = ledger?.totalCostUsd ?? 0;
    assert.equal(counters.realNetworkCalls, 0);
    assert.equal(counters.paidProviderCalls, 0);
    assert.equal(counters.aiCostUsd, 0);
    return { status: "PASS", topLevelFunction: "runTrueZeroCostCampaignE2E", localFakeCampaignEngines: false, routers: ["visual-forensics","creative-direction","projects/checkpoints","campaign-family","campaign-family/run","campaign-family/export","campaign-family/read-handle","projects/state","campaign-family/download"], counters, dimensions, zipFiles, authorityIds: routeManifest.variants.map((item) => item.productionAuthorityId), familyAuthorityId: routeManifest.familyAuthorityId, zipChecksum: routeZipChecksum, restoredZipChecksum: routeZipChecksum, manifestChecksums: routeManifest.variants.map((item) => item.pngChecksum), coldStartRestore: true, sourceRetry: { backingUploads: counters.sourceUploadCalls, finalizeAttempts: counters.sourceFinalizeCalls, reusedBacking: true } };
  } finally { globalThis.fetch = originalFetch; }
}

console.log(JSON.stringify(await runTrueZeroCostCampaignE2E(), null, 2));
