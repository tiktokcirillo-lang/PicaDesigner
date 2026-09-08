import {calculateActualCost} from '../src/infrastructure/ai/budget/cost-calculator.js';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

type ScenarioName = 'LOW' | 'NORMAL' | 'HIGH' | 'REAL_CALIBRATED';
interface UsageProfile {inputTokens: number; cachedInputTokens: number; cacheWriteTokens: number; outputTokens: number}
interface Scenario {terraUsage: UsageProfile; solUsage: UsageProfile; terraCalls: number; solRate: number; imageCostUsd:number;imageRate:number;qaRate:number;qaCostUsd:number;regenerationRate:number;regenerationCostUsd:number}
const SCENARIOS: Record<Exclude<ScenarioName, 'REAL_CALIBRATED'>, Scenario> = {
  LOW: {terraUsage: {inputTokens: 4500, cachedInputTokens: 1000, cacheWriteTokens: 300, outputTokens: 900}, solUsage: {inputTokens: 6000, cachedInputTokens: 1500, cacheWriteTokens: 400, outputTokens: 900}, terraCalls: 3, solRate: 0.05,imageCostUsd:.08,imageRate:.35,qaRate:.35,qaCostUsd:.03,regenerationRate:.03,regenerationCostUsd:.10},
  NORMAL: {terraUsage: {inputTokens: 9000, cachedInputTokens: 1800, cacheWriteTokens: 700, outputTokens: 1800}, solUsage: {inputTokens: 10000, cachedInputTokens: 2500, cacheWriteTokens: 800, outputTokens: 1800}, terraCalls: 5, solRate: 0.20,imageCostUsd:.16,imageRate:.6,qaRate:.6,qaCostUsd:.06,regenerationRate:.10,regenerationCostUsd:.18},
  HIGH: {terraUsage: {inputTokens: 15000, cachedInputTokens: 2200, cacheWriteTokens: 1200, outputTokens: 3000}, solUsage: {inputTokens: 14000, cachedInputTokens: 3000, cacheWriteTokens: 1400, outputTokens: 2800}, terraCalls: 5, solRate: 0.40,imageCostUsd:.30,imageRate:.85,qaRate:.85,qaCostUsd:.10,regenerationRate:.25,regenerationCostUsd:.30},
};
export interface CostCalibrationFile {schemaVersion: '1.0.0'; calls: Array<{model: string; inputTokens: number; cachedInputTokens: number; cacheWriteTokens: number; outputTokens: number}>; solExecuted: boolean}
const calibratedScenario = (calibration: CostCalibrationFile): Scenario => {
  const terraCalls = calibration.calls.filter(({model}) => model === 'gpt-5.6-terra');
  const solCalls = calibration.calls.filter(({model}) => model === 'gpt-5.6-sol');
  const average = (calls: typeof terraCalls): UsageProfile => calls.length ? ({inputTokens: calls.reduce((sum, item) => sum + item.inputTokens, 0) / calls.length, cachedInputTokens: calls.reduce((sum, item) => sum + item.cachedInputTokens, 0) / calls.length, cacheWriteTokens: calls.reduce((sum, item) => sum + item.cacheWriteTokens, 0) / calls.length, outputTokens: calls.reduce((sum, item) => sum + item.outputTokens, 0) / calls.length}) : {inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0};
  return {terraUsage: average(terraCalls), solUsage: average(solCalls), terraCalls: terraCalls.length, solRate: calibration.solExecuted ? 1 : 0,imageCostUsd:0,imageRate:0,qaRate:0,qaCostUsd:0,regenerationRate:0,regenerationCostUsd:0};
};
export const simulateAICost = (scenario: ScenarioName, projects = 20, calibration?: CostCalibrationFile) => {
  if (scenario === 'REAL_CALIBRATED' && !calibration) throw new Error('REAL_CALIBRATED is unavailable until data/ai-cost-calibration.json is produced by a live smoke test.');
  const settings = scenario === 'REAL_CALIBRATED' ? calibratedScenario(calibration!) : SCENARIOS[scenario];
  const terra = calculateActualCost('gpt-5.6-terra', settings.terraUsage) * settings.terraCalls;
  const sol = calculateActualCost('gpt-5.6-sol', settings.solUsage);
  const costs = Array.from({length: projects}, (_, index) => {let cost=terra+(index<Math.round(projects*settings.solRate)?sol:0)+(index<Math.round(projects*settings.imageRate)?settings.imageCostUsd:0),qa=index<Math.round(projects*settings.qaRate)?settings.qaCostUsd:0;if(cost+qa<=.75)cost+=qa;const regen=index<Math.round(projects*settings.regenerationRate)?settings.regenerationCostUsd:0;if(cost+regen+qa<=.75)cost+=regen;return cost});
  return {scenario, projects, averageProjectCost: costs.reduce((sum, value) => sum + value, 0) / projects, monthlyCost: costs.reduce((sum, value) => sum + value, 0), terraCalls: settings.terraCalls * projects, solEscalationPercentage: Math.round(settings.solRate * 100),imageGenerationPercentage:Math.round(settings.imageRate*100),imageCalls:Math.round(projects*settings.imageRate),postRenderQaPercentage:Math.round(settings.qaRate*100),assetRegenerationPercentage:Math.round(settings.regenerationRate*100),costDistribution: {min: Math.min(...costs), max: Math.max(...costs)}, projectsOverTarget: costs.filter((value) => value > 0.5).length, projectsOverHardLimit: costs.filter((value) => value > 0.75).length};
};
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const scenario of ['LOW', 'NORMAL', 'HIGH'] as const) console.log(JSON.stringify(simulateAICost(scenario), null, 2));
  const calibrationPath = resolve('data/ai-cost-calibration.json');
  if (existsSync(calibrationPath)) console.log(JSON.stringify(simulateAICost('REAL_CALIBRATED', 20, JSON.parse(readFileSync(calibrationPath, 'utf8')) as CostCalibrationFile), null, 2));
  else console.log(JSON.stringify({scenario: 'REAL_CALIBRATED', status: 'unavailable', reason: 'Run openai:smoke with --save-calibration first.'}, null, 2));
}
