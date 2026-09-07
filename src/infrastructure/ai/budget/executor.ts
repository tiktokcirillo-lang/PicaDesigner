import {calculateActualCost, estimateCallCost, type EstimatedCallUsage} from './cost-calculator.js';
import {assertCallWithinBudget} from './budget-policy.js';
import {appendModelCall, type BudgetStore} from './budget-tracker.js';
import type {AIProvider, AIStructuredRequest, AIStructuredResponse, ProjectCostLedger} from '../types.js';
import {AIBudgetExceededError} from '../providers/errors.js';

export class BudgetedAIExecutor {
  constructor(private readonly provider: AIProvider, private readonly store: BudgetStore, private readonly hardLimitUsd: number, private ledger: ProjectCostLedger, private monthlyRemainingUsd = Number.POSITIVE_INFINITY) {}
  getLedger(): ProjectCostLedger {return this.ledger;}
  async execute<T>(request: AIStructuredRequest, estimate: EstimatedCallUsage): Promise<AIStructuredResponse<T>> {
    const estimatedCost = estimateCallCost(request.model, estimate);
    assertCallWithinBudget(this.ledger, estimatedCost, this.hardLimitUsd);
    if (estimatedCost > this.monthlyRemainingUsd) throw new AIBudgetExceededError('AI call blocked: estimated cost exceeds the remaining monthly budget.');
    const response = await this.provider.generateStructured<T>(request);
    const costUsd = calculateActualCost(response.model, response.usage);
    this.monthlyRemainingUsd = Math.max(0, this.monthlyRemainingUsd - costUsd);
    if (this.ledger.totalCostUsd + costUsd > this.hardLimitUsd) {
      // The call already completed; keep the true ledger and block every subsequent call.
      this.ledger = appendModelCall(this.ledger, {...response.usage, requestId: response.requestId, pass: request.pass, model: response.model, costUsd, durationMs: response.durationMs, maxOutputTokens: request.maxOutputTokens, outputTokenUtilization: request.maxOutputTokens > 0 ? response.usage.outputTokens / request.maxOutputTokens : 0, repairAttempt: request.repairAttempt ?? false});
      await this.store.saveProject(this.ledger);
      return response;
    }
    this.ledger = appendModelCall(this.ledger, {...response.usage, requestId: response.requestId, pass: request.pass, model: response.model, costUsd, durationMs: response.durationMs, maxOutputTokens: request.maxOutputTokens, outputTokenUtilization: request.maxOutputTokens > 0 ? response.usage.outputTokens / request.maxOutputTokens : 0, repairAttempt: request.repairAttempt ?? false});
    await this.store.saveProject(this.ledger);
    return response;
  }
}
