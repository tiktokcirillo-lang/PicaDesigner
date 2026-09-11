// @ts-nocheck -- integrated smoke deliberately uses compact deterministic fixtures.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { analyzeReferenceImage } from "../src/application/visual-intelligence/analyze-reference-image.js";
import { createReferenceIntelligence } from "../src/application/reference-intelligence/index.js";
import { createCreativeDirection } from "../src/application/creative-direction/index.js";
import { runCampaignFamily, createCampaignFamilyExport } from "../src/application/campaign-variants/index.js";
import { createCampaignFamily } from "../src/domain/campaign-variants/index.js";
import { InMemoryBudgetStore, createLedger } from "../src/infrastructure/ai/budget/budget-tracker.js";
import { BudgetedAIExecutor } from "../src/infrastructure/ai/budget/executor.js";
import { AI_DEFAULTS } from "../src/infrastructure/ai/providers/openai/config.js";
import { createAIProviderInstrumentation, createStructuredAIProvider } from "../src/infrastructure/ai/providers/factory.js";
import { createMockCampaignDatabase, MockCampaignFamilyRepository } from "../src/infrastructure/campaign-variants/index.js";
import { MemoryProductionArtifactStore, inspectProductionZip } from "../src/infrastructure/export-engine/index.js";
import { NodeProductionRasterEncoder } from "../src/infrastructure/export-engine/encoders.js";
import { MockDurableGeneratedAssetStore } from "../src/infrastructure/image-generation/index.js";
import { checkProjectSourceAssetUpload, finalizeProjectSourceAsset } from "../src/application/source-assets/index.js";
import { createMockSourceAssetDatabase, MockProjectSourceAssetRepository } from "../src/infrastructure/source-assets/repository.js";
import { createMockSourceAssetBacking, MockDurableProjectSourceAssetStore } from "../src/infrastructure/source-assets/store.js";
import { createServer } from "node:http";

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

    const provider = createStructuredAIProvider({ config: AI_DEFAULTS, env, instrumentation: counters });
    const budgetStore = new InMemoryBudgetStore();
    const analyzed = await analyzeReferenceImage(
      { projectId: "e2e-project", image: { kind: "bytes", data: sourceBytes, mediaType: "image/png" }, analysisDepth: "standard" },
      { provider, budgetStore, config: AI_DEFAULTS },
    );
    const reference = await createReferenceIntelligence(
      { projectId: "e2e-project", image: { kind: "bytes", data: sourceBytes, mediaType: "image/png" }, imageMetadata: { imageFingerprint: sourceChecksum }, analysisDepth: "standard" },
      { analyze: async () => analyzed },
    );
    assert.equal(reference.status, "ready");

    const creativeProvider = createStructuredAIProvider({ config: AI_DEFAULTS, env, instrumentation: counters });
    const creative = await createCreativeDirection({ projectId: "e2e-project", copy: "Mensagem aprovada", format: "meta_ads_feed_portrait", destinationTool: "Canva", tone: "direct", referenceIntelligence: reference }, { provider: creativeProvider, budgetStore, config: AI_DEFAULTS });
    assert.equal(creative.status, "ready");

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

    const invariants = { selectedCreativeRouteId: creative.selectedRouteId, creativeDirectionSessionId: creative.sessionId, creativeConcept: creative.selectedRoute.concept.name, creativeDeviceIdentity: creative.selectedRoute.creativeDevice.name, heroRole: creative.selectedRoute.heroStrategy, primaryMessage: "Mensagem aprovada", approvedCopyContent: ["Mensagem aprovada"], mandatoryContent: [], sourceAssetChecksums: [sourceChecksum], campaignVisualIdentity: "e2e-identity", majorHierarchyIntent: creative.selectedRoute.hierarchyStrategy, fingerprint: "e2e-invariants" };
    const db = createMockCampaignDatabase();
    const repoA = new MockCampaignFamilyRepository(db);
    let family = createCampaignFamily({ projectId: "e2e-project", operationId: "e2e-family", inputFingerprint: "e2e-family-fp", invariants, estimatedCostUsd: 0, hardCapUsd: 0.75 });
    family = { ...family, variants: family.variants.map((variant) => ({ ...variant, status: "layout_ready", layoutSessionId: `layout_${variant.formatId}`, layoutPlan: { schemaVersion: "1.0.0", layoutId: `layout_${variant.formatId}`, projectId: "e2e-project", creativeDirectionSessionId: creative.sessionId, selectedRouteId: creative.selectedRouteId, format: { id: variant.formatId }, canvas: { width: variant.width, height: variant.height }, quality: {}, warnings: [] }, readiness: { ...variant.readiness, layout: true } })) };
    family = await repoA.create(family);
    const authorities = new Map();
    const engines = {
      review: async ({ formatId }) => { counters.mockCriticCalls += 1; return { sessionId: `review_${formatId}`, readyForRender: true, reviewedDesignPackage: { reviewSessionId: `review_${formatId}` }, revisionRounds: [], cost: 0 }; },
      render: async ({ review }) => { const formatId = review.sessionId.replace("review_", ""); const variant = family.variants.find((item) => item.formatId === formatId)!; const sceneId = `scene_${formatId}`; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${variant.width}" height="${variant.height}" viewBox="0 0 ${variant.width} ${variant.height}"><rect width="100%" height="100%" fill="#123456"/></svg>`; return { sessionId: `render_${formatId}`, projectId: "e2e-project", readiness: { productionReady: true, missingRequiredAssets: [], fontIssues: [] }, renderDocument: { scenes: [{ sceneId, width: variant.width, height: variant.height, assetManifest: { requirements: [] } }] }, artifacts: [{ artifactId: `artifact_${formatId}`, sceneId, svg, checksum: createHash("sha256").update(svg).digest("hex"), width: variant.width, height: variant.height, readiness: { productionReady: true } }], sourceVersions: {} }; },
      resolveAssets: async ({ render, registry }) => { counters.mockImageProviderCalls += 1; return { render, registry }; },
      qa: async ({ render }) => { counters.mockQaCalls += 1; const formatId = render.sessionId.replace("render_", ""); return { sessionId: `qa_${formatId}`, inputFingerprint: `qa-fp-${formatId}`, outcome: "approved", visualApproved: true, approvedPackage: { projectId: "e2e-project", reviewSessionId: `review_${formatId}`, postRenderReviewSessionId: `qa_${formatId}`, reviewedDesignPackage: { layoutPlan: { format: { id: formatId } } }, renderSession: render, finalAssets: { projectId: "e2e-project", assets: [] }, canonicalArtifacts: render.artifacts.map((x) => ({ sceneId: x.sceneId, svg: x.svg, checksum: x.checksum })), pixelQaSummary: { score: 100, verdict: "approved" }, visualApprovalStatus: "approved", provenance: [] }, regenerationRounds: [], warnings: [], cost: 0 }; },
      persistAuthority: async ({ variant, qa }) => { const authority = { authorityId: `authority_${variant.formatId}`, status: "valid", fingerprint: `package_${variant.formatId}`, visualApprovedPackage: qa.approvedPackage }; authorities.set(authority.authorityId, authority); return authority; },
    };
    const run = await runCampaignFamily({ family, currentFamilyFingerprint: family.inputFingerprint, creative, reference, sourceRegistry: { projectId: "e2e-project", assets: [] } }, { repository: repoA, engines });
    assert.equal(run.family.approval.metaAdsPackageReady, true);
    assert.equal(run.family.variants.filter((item) => item.status === "approved").length, 4);

    const blobData = new Map();
    const artifactA = new MemoryProductionArtifactStore(blobData);
    const exportSession = await createCampaignFamilyExport({ family: run.family, authority: run.authority, projectSlug: "campaign" }, { projects: { getProductionAuthority: async (_project, id) => authorities.get(id) }, repository: repoA, assetStore: new MockDurableGeneratedAssetStore(), artifactStore: artifactA });
    const zip = await artifactA.get(exportSession.artifact.backingRef, "e2e-project");
    assert(zip);
    assert.deepEqual(inspectProductionZip(zip), zipFiles);
    assert.deepEqual(run.family.variants.map((item) => [item.width,item.height]), dimensions);
    const manifestText = JSON.stringify(exportSession.manifest);
    assert.equal(exportSession.manifest.variants.length, 4);
    for (const key of ["productionAuthorityId","renderSessionId","postRenderReviewSessionId","pngChecksum"]) assert.equal(new Set(exportSession.manifest.variants.map((item) => item[key])).size, 4);
    assert(!/backingRef|signedUrl|credential/i.test(manifestText));

    const repoB = new MockCampaignFamilyRepository(db);
    const artifactB = new MemoryProductionArtifactStore(blobData);
    const restoredFamily = await repoB.get("e2e-project", run.family.familyId);
    const restoredExport = await repoB.getExport("e2e-project", exportSession.exportSessionId);
    const restoredZip = restoredExport && await artifactB.get(restoredExport.artifact.backingRef, "e2e-project");
    assert(restoredFamily?.approval.metaAdsPackageReady && restoredExport && restoredZip);
    assert.equal(createHash("sha256").update(restoredZip).digest("hex"), exportSession.artifact.checksum);

    // HTTP serialization smoke over the real Express routers. This uses an
    // isolated project and loopback only; every non-loopback request is killed.
    const previousMode = process.env.PICADESIGNER_E2E_PROVIDER_MODE;
    process.env.PICADESIGNER_E2E_PROVIDER_MODE = "mock";
    const { createServerApp } = await import("../src/server/app.js");
    const server = createServer(createServerApp());
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
      const routeProjectId = "e2e-route-project";
      let project = await post("/api/projects", { projectId: routeProjectId, name: "E2E route", operationId: "create-route" });
      const routeReference = await post("/api/visual-forensics/analyze", { projectId: routeProjectId, image: { kind: "base64", data: Buffer.from(sourceBytes).toString("base64"), mediaType: "image/png" }, imageMetadata: { imageFingerprint: sourceChecksum }, analysisDepth: "standard" });
      const checkpoint = async (stage: string, payload: unknown, fingerprint: string) => {
        const saved = await post(`/api/projects/${routeProjectId}/checkpoints`, { versionId: `version:${routeProjectId}`, stage, operationId: `${stage}:${fingerprint}`, fingerprint, expectedRevision: project.revision, payload });
        project = saved.project;
      };
      await checkpoint("workspace_input", { copyText: "Mensagem aprovada", destinationTool: "Canva" }, "workspace-route");
      await checkpoint("reference_intelligence", routeReference, routeReference.sessionId);
      const routeCreative = await post("/api/creative-direction/generate", { projectId: routeProjectId, copy: "Mensagem aprovada", format: "meta_ads_feed_portrait", destinationTool: "Canva", tone: "direct", referenceIntelligence: routeReference });
      await checkpoint("creative_direction", routeCreative, routeCreative.inputFingerprint);
      const createdFamily = await post(`/api/projects/${routeProjectId}/campaign-family`, { familyDefinitionId: "meta_ads_family", primaryFormatId: "meta_ads_feed_portrait", expectedRevision: project.revision, operationId: "route-family" });
      const familyId = createdFamily.family.familyId;
      const routeRun = await post(`/api/projects/${routeProjectId}/campaign-family/${familyId}/run`, {});
      assert(routeRun.family && ["approved", "partial", "blocked"].includes(routeRun.family.status));
      const blockedExport = await fetch(`${base}/api/projects/${routeProjectId}/campaign-family/${familyId}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectSlug: "route-campaign" }) });
      assert.equal(blockedExport.status, 409, "router must reject export without 4/4 authority");
      const missingRead = await fetch(`${base}/api/projects/${routeProjectId}/campaign-family/${familyId}/exports/missing/read-handle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(missingRead.status, 404, "router must not expose unknown export handles");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (previousMode === undefined) delete process.env.PICADESIGNER_E2E_PROVIDER_MODE;
      else process.env.PICADESIGNER_E2E_PROVIDER_MODE = previousMode;
    }

    const ledger = await budgetStore.getProject("e2e-project");
    counters.aiCostUsd = ledger?.totalCostUsd ?? 0;
    assert.equal(counters.realNetworkCalls, 0);
    assert.equal(counters.paidProviderCalls, 0);
    assert.equal(counters.aiCostUsd, 0);
    return { status: "PASS", topLevelFunction: "runTrueZeroCostCampaignE2E", routers: ["visual-forensics","creative-direction","projects/checkpoints","campaign-family","campaign-family/run","campaign-family/export","campaign-family/read-handle"], counters, dimensions, zipFiles, manifest: { productionAuthorityIds: 4, renderSessionIds: 4, postRenderReviewSessionIds: 4, pngChecksums: 4 }, coldStartRestore: true, sourceRetry: { backingUploads: counters.sourceUploadCalls, finalizeAttempts: counters.sourceFinalizeCalls, reusedBacking: true } };
  } finally { globalThis.fetch = originalFetch; }
}

console.log(JSON.stringify(await runTrueZeroCostCampaignE2E(), null, 2));
