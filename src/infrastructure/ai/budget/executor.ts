import { createHash } from "node:crypto";
import {
  calculateActualCost,
  estimateCallCost,
  type EstimatedCallUsage,
} from "./cost-calculator.js";
import { ProjectAIBudgetCoordinator } from "./project-coordinator.js";
import type { BudgetStore } from "./budget-tracker.js";
import type {
  AIProvider,
  AIStage,
  AIStructuredRequest,
  AIStructuredResponse,
  ProjectCostLedger,
} from "../types.js";
import { AITimeoutError } from "../providers/errors.js";
import type { VisualInput } from "../../../domain/visual-forensics/index.js";

const visualForensicsPasses = new Set<AIStructuredRequest["pass"]>([
  "raw_observation",
  "spatial_relationships",
  "domain_analysis",
  "principle_inference",
  "consistency_check",
  "repair",
]);

const stageFor = (pass: AIStructuredRequest["pass"]): AIStage => {
  if (pass === "creative_direction") return "creative_direction";
  if (pass === "creative_direction_revision") return "art_direction_revision";
  if (pass === "generate_design_spec") return "design_spec";
  if (pass === "sol_critic") return "senior_critic";
  if (visualForensicsPasses.has(pass)) return "visual_forensics";
  return "other";
};
const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
const imageIdentity = (image: VisualInput) =>
  image.kind === "base64"
    ? {
        kind: "binary",
        mediaType: image.mediaType,
        bytesSha256: sha256(Buffer.from(image.data, "base64")),
      }
    : image.kind === "bytes"
      ? {
          kind: "binary",
          mediaType: image.mediaType,
          bytesSha256: sha256(image.data),
        }
      : { kind: image.kind, urlSha256: sha256(image.url) };

/** Stable, private identity of the complete semantic provider input. */
export const stableOperationId = (
  request: AIStructuredRequest,
  stage: AIStage = stageFor(request.pass),
) => {
  const payload = canonical({
    projectId: request.projectId,
    stage,
    pass: request.pass,
    model: request.model,
    schemaName: request.schemaName,
    jsonSchema: request.jsonSchema,
    repairAttempt: request.repairAttempt ?? false,
    reasoningEffort: request.reasoningEffort,
    maxOutputTokens: request.maxOutputTokens,
    instructions: request.instructions,
    inputText: request.inputText,
    image: request.image ? imageIdentity(request.image) : undefined,
    images: request.images?.map(imageIdentity),
  });
  return `aiop:${sha256(JSON.stringify(payload)).slice(0, 40)}`;
};

export interface BudgetedExecutorOptions {
  monthlyLimitUsd?: number;
  safetyFactor?: number;
  ttlSeconds?: number;
  stage?: AIStage;
  stageLimitUsd?: number;
}
export class BudgetedAIExecutor {
  private readonly coordinator: ProjectAIBudgetCoordinator;
  constructor(
    private readonly provider: AIProvider,
    store: BudgetStore,
    hardLimitUsd: number,
    private ledger: ProjectCostLedger,
    legacyMonthlyRemainingUsd = Number.POSITIVE_INFINITY,
    private readonly options: BudgetedExecutorOptions = {},
  ) {
    this.coordinator = new ProjectAIBudgetCoordinator(store, {
      projectLimitUsd: hardLimitUsd,
      monthlyLimitUsd: Math.min(
        options.monthlyLimitUsd ?? 15,
        legacyMonthlyRemainingUsd,
      ),
      safetyFactor: options.safetyFactor ?? 1.2,
      ttlSeconds: options.ttlSeconds ?? 600,
    });
  }
  getLedger() {
    return this.ledger;
  }
  async execute<T>(
    request: AIStructuredRequest,
    estimate: EstimatedCallUsage,
  ): Promise<AIStructuredResponse<T>> {
    const estimatedCostUsd = estimateCallCost(request.model, estimate),
      stage =
        request.pass === "sol_critic"
          ? "senior_critic"
          : (this.options.stage ?? stageFor(request.pass)),
      operationId = stableOperationId(request, stage),
      reservation = await this.coordinator.reserve({
        projectId: request.projectId,
        stage,
        estimatedCostUsd,
        stageLimitUsd: this.options.stageLimitUsd,
        operationId,
      });
    try {
      const response = await this.provider.generateStructured<T>(request),
        costUsd = calculateActualCost(response.model, response.usage),
        call = {
          ...response.usage,
          requestId: response.requestId,
          pass: request.pass,
          model: response.model,
          costUsd,
          durationMs: response.durationMs,
          maxOutputTokens: request.maxOutputTokens,
          outputTokenUtilization:
            request.maxOutputTokens > 0
              ? response.usage.outputTokens / request.maxOutputTokens
              : 0,
          repairAttempt: request.repairAttempt ?? false,
          stage,
          operationId,
        };
      this.ledger = await this.coordinator.commit(
        reservation.reservationId,
        call,
      );
      return response;
    } catch (error) {
      if (error instanceof AITimeoutError)
        await this.coordinator.resolveUnknown(reservation.reservationId);
      else await this.coordinator.release(reservation.reservationId);
      throw error;
    }
  }
}
