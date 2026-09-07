import 'dotenv/config';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {analyzeReferenceImage} from '../src/application/visual-intelligence/analyze-reference-image.js';
import {InMemoryBudgetStore} from '../src/infrastructure/ai/budget/budget-tracker.js';
import {resolveSmokeMaxCost} from '../src/infrastructure/ai/budget/smoke-policy.js';
import {loadOpenAIConfig} from '../src/infrastructure/ai/providers/openai/config.js';
import {OpenAIProvider} from '../src/infrastructure/ai/providers/openai/responses.js';

const args = process.argv.slice(2);
const imagePath = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--max-cost');
const allowSol = args.includes('--allow-sol');
const saveCalibration = args.includes('--save-calibration');
const maxCostIndex = args.indexOf('--max-cost');
const maxCost = resolveSmokeMaxCost(maxCostIndex >= 0 ? Number(args[maxCostIndex + 1]) : undefined);
const config = loadOpenAIConfig();

const dimensions = (data: Buffer, mediaType: string): {width?: number; height?: number} => {
  if (mediaType === 'image/png' && data.length >= 24) return {width: data.readUInt32BE(16), height: data.readUInt32BE(20)};
  if (mediaType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < data.length) {const marker = data[offset + 1]; const length = data.readUInt16BE(offset + 2); if (marker >= 0xc0 && marker <= 0xc3) return {height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7)}; offset += 2 + length;}
  }
  return {};
};

if (!config.apiKey) console.log('OPENAI_API_KEY is not configured; live smoke test skipped safely.');
else if (!imagePath) console.log('Usage: npm run openai:smoke -- <image> [--max-cost 0.50] [--save-calibration] [--allow-sol]');
else {
  const media = ({'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'} as const)[extname(imagePath).toLowerCase() as '.jpg'];
  if (!media) throw new Error('Unsupported image type. Use JPEG, PNG, or WebP.');
  const image = await readFile(imagePath);
  const projectId = `smoke-${Date.now()}`;
  const result = await analyzeReferenceImage({projectId, image: {kind: 'bytes', data: image, mediaType: media}, analysisDepth: 'standard'}, {provider: new OpenAIProvider(config), budgetStore: new InMemoryBudgetStore(), config: {...config, maxProjectCostUsd: Math.min(maxCost, config.maxProjectCostUsd), targetProjectCostUsd: Math.min(maxCost, config.targetProjectCostUsd), solEscalationEnabled: allowSol}});
  const calls = result.aiUsage.calls.map((call, index) => ({pass: index + 1, name: call.pass, model: call.model, inputTokens: call.inputTokens, cachedInputTokens: call.cachedInputTokens, cacheWriteTokens: call.cacheWriteTokens, outputTokens: call.outputTokens, reasoningTokens: call.reasoningTokens ?? 0, maxOutputTokens: call.maxOutputTokens, outputUtilization: call.outputTokenUtilization, durationMs: call.durationMs, costUsd: call.costUsd, repairAttempt: call.repairAttempt}));
  const summary = {project: projectId, analysisDepth: 'standard', calls, total: {inputTokens: result.aiUsage.inputTokens, cachedInputTokens: result.aiUsage.cachedInputTokens, cacheWriteTokens: result.aiUsage.cacheWriteTokens, outputTokens: result.aiUsage.outputTokens, costUsd: result.aiUsage.totalCostUsd}, qualityScore: result.quality.score, overallConfidence: result.forensics.overallConfidence, evidenceQuality: result.forensics.evidenceQuality.overall, speculationRisk: result.forensics.evidenceQuality.speculationRisk, solEscalationRecommended: result.quality.requiresCritic, solExecuted: result.aiUsage.escalationStatus === 'executed', targetStatus: result.aiUsage.totalCostUsd <= result.aiUsage.targetCostUsd ? 'within_target' : 'over_target', hardCapStatus: result.aiUsage.totalCostUsd < result.aiUsage.limitCostUsd ? 'within_cap' : 'at_cap'};
  console.log(JSON.stringify(summary, null, 2));
  if (saveCalibration) {
    const calibration = {schemaVersion: '1.0.0', createdAt: new Date().toISOString(), projectId, analysisDepth: 'standard', image: dimensions(image, media), calls: calls.map(({name, model, inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, reasoningTokens, maxOutputTokens, outputUtilization, durationMs, costUsd, repairAttempt}) => ({pass: name, model, inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, reasoningTokens, maxOutputTokens, outputUtilization, durationMs, costUsd, repairAttempt})), total: summary.total, quality: {score: summary.qualityScore, overallConfidence: summary.overallConfidence, evidenceQuality: summary.evidenceQuality, speculationRisk: summary.speculationRisk}, solExecuted: summary.solExecuted};
    await mkdir(resolve('data'), {recursive: true});
    await writeFile(resolve('data/ai-cost-calibration.json'), `${JSON.stringify(calibration, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
    console.log('Saved non-sensitive calibration metrics to data/ai-cost-calibration.json');
  }
}
