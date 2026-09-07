import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {analyzeReferenceImage} from '../src/application/visual-intelligence/analyze-reference-image';
import {InMemoryBudgetStore} from '../src/infrastructure/ai/budget/budget-tracker';
import {loadOpenAIConfig} from '../src/infrastructure/ai/providers/openai/config';
import {OpenAIProvider} from '../src/infrastructure/ai/providers/openai/responses';

const config = loadOpenAIConfig();
const imagePath = process.argv[2];
if (!config.apiKey) console.log('OPENAI_API_KEY is not configured; live smoke test skipped safely.');
else if (!imagePath) console.log('Usage: npm run openai:smoke -- <image.jpg|image.png|image.webp>');
else {
  const media = ({'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'} as const)[extname(imagePath).toLowerCase() as '.jpg'];
  if (!media) throw new Error('Unsupported image type. Use JPEG, PNG, or WebP.');
  const result = await analyzeReferenceImage({projectId: `smoke-${Date.now()}`, image: {kind: 'bytes', data: await readFile(imagePath), mediaType: media}, analysisDepth: 'standard'}, {provider: new OpenAIProvider(config), budgetStore: new InMemoryBudgetStore(), config: {...config, solEscalationEnabled: false}});
  console.log(JSON.stringify({models: result.aiUsage.modelsUsed, passes: result.aiUsage.calls.map(({pass}) => pass), confidence: result.forensics.overallConfidence, designDNASummary: {sections: Object.keys(result.designDNA), evidence: result.designDNA.evidence.observedFacts.length}, tokens: {input: result.aiUsage.inputTokens, cachedInput: result.aiUsage.cachedInputTokens, output: result.aiUsage.outputTokens}, costUsd: Number(result.aiUsage.totalCostUsd.toFixed(6))}, null, 2));
}
