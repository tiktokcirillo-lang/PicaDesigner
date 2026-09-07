import {calculateActualCost} from '../src/infrastructure/ai/budget/cost-calculator';

type ScenarioName = 'LOW' | 'NORMAL' | 'HIGH';
interface Scenario {terraUsage: {inputTokens: number; cachedInputTokens: number; outputTokens: number}; solUsage: {inputTokens: number; cachedInputTokens: number; outputTokens: number}; terraCalls: number; solRate: number}
const SCENARIOS: Record<ScenarioName, Scenario> = {
  LOW: {terraUsage: {inputTokens: 4500, cachedInputTokens: 1000, outputTokens: 900}, solUsage: {inputTokens: 6000, cachedInputTokens: 1500, outputTokens: 900}, terraCalls: 3, solRate: 0.05},
  NORMAL: {terraUsage: {inputTokens: 9000, cachedInputTokens: 1800, outputTokens: 1800}, solUsage: {inputTokens: 10000, cachedInputTokens: 2500, outputTokens: 1800}, terraCalls: 5, solRate: 0.20},
  HIGH: {terraUsage: {inputTokens: 15000, cachedInputTokens: 2200, outputTokens: 3000}, solUsage: {inputTokens: 14000, cachedInputTokens: 3000, outputTokens: 2800}, terraCalls: 5, solRate: 0.40},
};
export const simulateAICost = (scenario: ScenarioName, projects = 20) => {
  const settings = SCENARIOS[scenario];
  const terra = calculateActualCost('gpt-5.6-terra', settings.terraUsage) * settings.terraCalls;
  const sol = calculateActualCost('gpt-5.6-sol', settings.solUsage);
  const costs = Array.from({length: projects}, (_, index) => terra + (index < Math.round(projects * settings.solRate) ? sol : 0));
  return {scenario, projects, averageProjectCost: costs.reduce((sum, value) => sum + value, 0) / projects, monthlyCost: costs.reduce((sum, value) => sum + value, 0), terraCalls: settings.terraCalls * projects, solEscalationPercentage: Math.round(settings.solRate * 100), costDistribution: {min: Math.min(...costs), max: Math.max(...costs)}, projectsOverTarget: costs.filter((value) => value > 0.5).length, projectsOverHardLimit: costs.filter((value) => value > 0.75).length};
};
if (import.meta.url === `file://${process.argv[1]}`) for (const scenario of ['LOW', 'NORMAL', 'HIGH'] as const) console.log(JSON.stringify(simulateAICost(scenario), null, 2));
