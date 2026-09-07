import {createSemanticExclusions} from '../../domain/art-direction/index.js';
import {createMinimalVisualForensicsReport, mapForensicsToDesignDNA} from '../../domain/visual-forensics/index.js';
import {MockAIProvider} from '../../infrastructure/ai/providers/mock.js';
import {AI_DEFAULTS, type OpenAIConfig} from '../../infrastructure/ai/providers/openai/config.js';
import {InMemoryBudgetStore} from '../../infrastructure/ai/budget/budget-tracker.js';
import type {AIUsageResult} from '../../infrastructure/ai/types.js';
import {generateDesignSpec} from '../legacy-ai/text-services.js';
import {analyzeVisualReference, fingerprintReferenceImage, invalidateReferenceIntelligence, isReusableReferenceSession} from '../../client/reference-intelligence.js';
import {createReferenceIntelligence, isReferenceQualityUsable} from './create-reference-intelligence.js';

const assert = (condition: boolean, message: string) => {if (!condition) throw new Error(`Reference Intelligence validation failed: ${message}`);};
const config: OpenAIConfig = {...AI_DEFAULTS, apiKey: '', requestTimeoutMs: 1000, maxRetries: 0};
const usage: AIUsageResult = {inputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 10, totalCostUsd: 0.001, targetCostUsd: 0.5, limitCostUsd: 0.75, modelsUsed: ['gpt-5.6-terra'], calls: [], escalationStatus: 'not_needed'};
const report = createMinimalVisualForensicsReport({sourceId: 'reference-test', analysisDepth: 'standard'}, createSemanticExclusions());
report.evidenceQuality = {coverage: 0.8, consistency: 0.8, measurementSupport: 0.7, observationToInferenceRatio: 0.8, speculationRisk: 0.1, overall: 0.8};
report.overallConfidence = 0.8;
const dna = mapForensicsToDesignDNA(report);
const quality = {score: 88, dimensions: {evidenceIntegrity: 80, compositionReasoning: 80, hierarchyReasoning: 80, typographicReasoning: 80, colorReasoning: 80, physicalPlausibility: 80, semanticSeparation: 100, antiAiDetection: 80, confidenceCalibration: 80}, issues: [], requiresCritic: false};
const image = {kind: 'base64' as const, data: 'AA==', mediaType: 'image/png'};

let analyses = 0;
const session = await createReferenceIntelligence({projectId: 'project-reference', image, imageMetadata: {imageFingerprint: 'same'}, analysisDepth: 'standard'}, {analyze: async () => {analyses += 1; return {forensics: report, designDNA: dna, quality, aiUsage: usage};}});
assert(analyses === 1 && Boolean(session.designDNA) && session.status === 'ready', 'image produces forensics, DesignDNA, and a ready session');
assert(isReferenceQualityUsable(session), 'healthy report passes minimum quality');
assert(isReusableReferenceSession(session, 'same', 'standard', 'project-reference'), 'same image session is reusable');
assert(!isReusableReferenceSession(session, 'changed', 'standard', 'project-reference'), 'changed image invalidates session');
assert(!isReusableReferenceSession(session, 'same', 'deep', 'project-reference'), 'changed depth invalidates session');
const firstFingerprint = await fingerprintReferenceImage({data: 'AA==', mimeType: 'image/png', name: 'a.png', size: 1, lastModified: 1});
const secondFingerprint = await fingerprintReferenceImage({data: 'AQ==', mimeType: 'image/png', name: 'b.png', size: 1, lastModified: 1});
assert(firstFingerprint !== secondFingerprint, 'fingerprint changes with image content');
const browserImage = {data: 'AA==', mimeType: 'image/png', name: 'a.png', size: 1, lastModified: 1};
let fetches = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {fetches += 1; return new Response(JSON.stringify({...session, source: {...session.source, imageFingerprint: firstFingerprint}}), {status: 200, headers: {'Content-Type': 'application/json'}});};
invalidateReferenceIntelligence();
await analyzeVisualReference({image: browserImage, projectId: 'project-reference'});
await analyzeVisualReference({image: browserImage, projectId: 'project-reference'});
assert(fetches === 1, 'same image executes forensics only once');
await analyzeVisualReference({image: {...browserImage, data: 'AQ==', name: 'b.png'}, projectId: 'project-reference'});
assert(fetches === 2, 'changed image executes forensics again');
globalThis.fetch = originalFetch;

let designInput = '';
const provider = new MockAIProvider((request) => {designInput = request.inputText; return {text: 'Especificação.'};});
const dependencies = {provider, budgetStore: new InMemoryBudgetStore(), config};
const textOnly = await generateDesignSpec({projectId: 'text-only', copy: 'Copy', format: '16:9', destinationTool: 'PowerPoint', tone: 'premium'}, dependencies);
assert(textOnly.content === 'Especificação.', 'text without image still generates a design specification');
const withReference = await generateDesignSpec({projectId: 'project-reference', copy: 'Copy', format: '16:9', destinationTool: 'PowerPoint', tone: 'premium', referenceIntelligence: session}, dependencies);
assert(withReference.referenceSessionId === session.sessionId && designInput.includes('referenceDesignDNA'), 'design spec receives compact reference context');

let failureObserved = false;
try {await createReferenceIntelligence({projectId: 'failed', image}, {analyze: async () => {throw new Error('forensics failed');}});} catch {failureObserved = true;}
assert(failureObserved, 'forensics failure is explicit');

const lowReport = structuredClone(report); lowReport.evidenceQuality.overall = 0.4; lowReport.overallConfidence = 0.4;
const lowSession = await createReferenceIntelligence({projectId: 'low', image}, {analyze: async () => ({forensics: lowReport, designDNA: mapForensicsToDesignDNA(lowReport), quality: {...quality, score: 40}, aiUsage: usage})});
assert(lowSession.status === 'partial' && !isReferenceQualityUsable(lowSession), 'low quality report becomes controlled partial session');
let lowBlocked = false;
try {await generateDesignSpec({projectId: 'low', copy: 'Copy', format: '16:9', destinationTool: 'PowerPoint', tone: 'premium', referenceIntelligence: lowSession}, dependencies);} catch {lowBlocked = true;}
assert(lowBlocked, 'low quality reference blocks design generation');
