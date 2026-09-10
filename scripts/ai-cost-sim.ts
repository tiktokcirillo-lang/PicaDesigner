import { calculateActualCost } from "../src/infrastructure/ai/budget/cost-calculator.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCampaignBudgetPreflight } from "../src/domain/campaign-variants/index.js";

type ScenarioName = "LOW" | "NORMAL" | "HIGH" | "REAL_CALIBRATED";
interface UsageProfile {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}
interface Scenario {
  terraUsage: UsageProfile;
  solUsage: UsageProfile;
  terraCalls: number;
  solRate: number;
  imageCostUsd: number;
  imageRate: number;
  qaRate: number;
  qaCostUsd: number;
  regenerationRate: number;
  regenerationCostUsd: number;
}
const SCENARIOS: Record<Exclude<ScenarioName, "REAL_CALIBRATED">, Scenario> = {
  LOW: {
    terraUsage: {
      inputTokens: 4500,
      cachedInputTokens: 1000,
      cacheWriteTokens: 300,
      outputTokens: 900,
    },
    solUsage: {
      inputTokens: 6000,
      cachedInputTokens: 1500,
      cacheWriteTokens: 400,
      outputTokens: 900,
    },
    terraCalls: 3,
    solRate: 0.05,
    imageCostUsd: 0.08,
    imageRate: 0.35,
    qaRate: 0.35,
    qaCostUsd: 0.03,
    regenerationRate: 0.03,
    regenerationCostUsd: 0.1,
  },
  NORMAL: {
    terraUsage: {
      inputTokens: 9000,
      cachedInputTokens: 1800,
      cacheWriteTokens: 700,
      outputTokens: 1800,
    },
    solUsage: {
      inputTokens: 10000,
      cachedInputTokens: 2500,
      cacheWriteTokens: 800,
      outputTokens: 1800,
    },
    terraCalls: 5,
    solRate: 0.2,
    imageCostUsd: 0.16,
    imageRate: 0.6,
    qaRate: 0.6,
    qaCostUsd: 0.06,
    regenerationRate: 0.1,
    regenerationCostUsd: 0.18,
  },
  HIGH: {
    terraUsage: {
      inputTokens: 15000,
      cachedInputTokens: 2200,
      cacheWriteTokens: 1200,
      outputTokens: 3000,
    },
    solUsage: {
      inputTokens: 14000,
      cachedInputTokens: 3000,
      cacheWriteTokens: 1400,
      outputTokens: 2800,
    },
    terraCalls: 5,
    solRate: 0.4,
    imageCostUsd: 0.3,
    imageRate: 0.85,
    qaRate: 0.85,
    qaCostUsd: 0.1,
    regenerationRate: 0.25,
    regenerationCostUsd: 0.3,
  },
};
export interface CostCalibrationFile {
  schemaVersion: "1.0.0";
  calls: Array<{
    model: string;
    inputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
  }>;
  solExecuted: boolean;
}
const calibratedScenario = (calibration: CostCalibrationFile): Scenario => {
  const terraCalls = calibration.calls.filter(
    ({ model }) => model === "gpt-5.6-terra",
  );
  const solCalls = calibration.calls.filter(
    ({ model }) => model === "gpt-5.6-sol",
  );
  const average = (calls: typeof terraCalls): UsageProfile =>
    calls.length
      ? {
          inputTokens:
            calls.reduce((sum, item) => sum + item.inputTokens, 0) /
            calls.length,
          cachedInputTokens:
            calls.reduce((sum, item) => sum + item.cachedInputTokens, 0) /
            calls.length,
          cacheWriteTokens:
            calls.reduce((sum, item) => sum + item.cacheWriteTokens, 0) /
            calls.length,
          outputTokens:
            calls.reduce((sum, item) => sum + item.outputTokens, 0) /
            calls.length,
        }
      : {
          inputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: 0,
        };
  return {
    terraUsage: average(terraCalls),
    solUsage: average(solCalls),
    terraCalls: terraCalls.length,
    solRate: calibration.solExecuted ? 1 : 0,
    imageCostUsd: 0,
    imageRate: 0,
    qaRate: 0,
    qaCostUsd: 0,
    regenerationRate: 0,
    regenerationCostUsd: 0,
  };
};
export const simulateAICost = (
  scenario: ScenarioName,
  projects = 20,
  calibration?: CostCalibrationFile,
) => {
  if (scenario === "REAL_CALIBRATED" && !calibration)
    throw new Error(
      "REAL_CALIBRATED is unavailable until data/ai-cost-calibration.json is produced by a live smoke test.",
    );
  const settings =
    scenario === "REAL_CALIBRATED"
      ? calibratedScenario(calibration!)
      : SCENARIOS[scenario];
  const terra =
    calculateActualCost("gpt-5.6-terra", settings.terraUsage) *
    settings.terraCalls;
  const sol = calculateActualCost("gpt-5.6-sol", settings.solUsage);
  const costs = Array.from({ length: projects }, (_, index) => {
    let cost =
        terra +
        (index < Math.round(projects * settings.solRate) ? sol : 0) +
        (index < Math.round(projects * settings.imageRate)
          ? settings.imageCostUsd
          : 0),
      qa =
        index < Math.round(projects * settings.qaRate) ? settings.qaCostUsd : 0;
    if (cost + qa <= 0.75) cost += qa;
    const regen =
      index < Math.round(projects * settings.regenerationRate)
        ? settings.regenerationCostUsd
        : 0;
    if (cost + regen + qa <= 0.75) cost += regen;
    return cost;
  });
  return {
    scenario,
    projects,
    averageProjectCost: costs.reduce((sum, value) => sum + value, 0) / projects,
    monthlyCost: costs.reduce((sum, value) => sum + value, 0),
    terraCalls: settings.terraCalls * projects,
    solEscalationPercentage: Math.round(settings.solRate * 100),
    imageGenerationPercentage: Math.round(settings.imageRate * 100),
    imageCalls: Math.round(projects * settings.imageRate),
    postRenderQaPercentage: Math.round(settings.qaRate * 100),
    assetRegenerationPercentage: Math.round(settings.regenerationRate * 100),
    costDistribution: { min: Math.min(...costs), max: Math.max(...costs) },
    projectsOverTarget: costs.filter((value) => value > 0.5).length,
    projectsOverHardLimit: costs.filter((value) => value > 0.75).length,
  };
};
export const simulateMetaAdsFamilyCost = (
  scenario: "LOW" | "NORMAL" | "HIGH",
  projects = 20,
) => {
  const settings = {
      LOW: {
        upstreamSpent: 0.12,
        base: 0.16,
        sharedGeneration: 0.08,
        qa: 0.04,
        completion: 1,
        reuse: 0.9,
        batching: 0,
        providerCalls: 8.2,
        correction: 0.03,
        correctionCost: 0.1,
        blocked: 0,
      },
      NORMAL: {
        upstreamSpent: 0.2,
        base: 0.28,
        sharedGeneration: 0.16,
        qa: 0.08,
        completion: 0.95,
        reuse: 0.75,
        batching: 0,
        providerCalls: 8.8,
        correction: 0.1,
        correctionCost: 0.18,
        blocked: 0.05,
      },
      HIGH: {
        upstreamSpent: 0.3,
        base: 0.43,
        sharedGeneration: 0.22,
        qa: 0.1,
        completion: 0.7,
        reuse: 0.55,
        batching: 0,
        providerCalls: 9.4,
        correction: 0.25,
        correctionCost: 0.3,
        blocked: 0.3,
      },
    }[scenario],
    runtimePreflight = evaluateCampaignBudgetPreflight({
      actualSpentUsd: settings.upstreamSpent,
      remainingHardCapUsd: 0.75 - settings.upstreamSpent,
      monthlyRemainingUsd: 15,
      remainingVariants: 4,
      reviewCostUsd: 0.052,
      qaCostUsd: 0.06,
      imageCostUsd: settings.sharedGeneration,
      verificationCostUsd: 0.06,
      hasResolvedSourceAsset: true,
      hasReusableGeneratedAsset: false,
    }),
    costs = Array.from({ length: projects }, (_, i) =>
      Math.min(
        0.75,
        settings.base +
          (i < Math.round(projects * (1 - settings.reuse))
            ? settings.sharedGeneration
            : 0) +
          settings.qa +
          (i < Math.round(projects * settings.correction)
            ? settings.correctionCost
            : 0),
      ),
    );
  return {
    scenario: `META_ADS_FAMILY_${scenario}`,
    projects,
    averageProjectCost: costs.reduce((a, b) => a + b, 0) / projects,
    maxProjectCost: Math.max(...costs),
    packageCompletionRate: settings.completion,
    averageProviderCalls: settings.providerCalls,
    generationReuseRate: settings.reuse,
    qaBatchingRate: settings.batching,
    correctionRate: settings.correction,
    budgetBlockedRate: settings.blocked,
    projectsOverTarget: costs.filter((x) => x > 0.5).length,
    projectsOverHardLimit: costs.filter((x) => x > 0.75).length,
    estimatedMandatoryRemaining: runtimePreflight.estimatedMandatoryRemaining,
    conditionalReserve: runtimePreflight.conditionalReserve,
    actualSpent: runtimePreflight.actualSpentUsd,
    remainingHardCap: runtimePreflight.remainingHardCapUsd,
    runtimePreflightAllowed: runtimePreflight.allowed,
  };
};
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const scenario of ["LOW", "NORMAL", "HIGH"] as const) {
    console.log(JSON.stringify(simulateAICost(scenario), null, 2));
    console.log(JSON.stringify(simulateMetaAdsFamilyCost(scenario), null, 2));
  }
  const calibrationPath = resolve("data/ai-cost-calibration.json");
  if (existsSync(calibrationPath))
    console.log(
      JSON.stringify(
        simulateAICost(
          "REAL_CALIBRATED",
          20,
          JSON.parse(
            readFileSync(calibrationPath, "utf8"),
          ) as CostCalibrationFile,
        ),
        null,
        2,
      ),
    );
  else
    console.log(
      JSON.stringify(
        {
          scenario: "REAL_CALIBRATED",
          status: "unavailable",
          reason: "Run openai:smoke with --save-calibration first.",
        },
        null,
        2,
      ),
    );
}
