import type {AIMonthlyBudget, AIModelCall, ProjectCostLedger} from '../types';

export interface BudgetStore {getProject(projectId: string): Promise<ProjectCostLedger | undefined>; saveProject(ledger: ProjectCostLedger): Promise<void>; getMonth(month: string, limitUsd: number): Promise<AIMonthlyBudget>}
export class InMemoryBudgetStore implements BudgetStore {
  private readonly projects = new Map<string, ProjectCostLedger>();
  async getProject(projectId: string) {return this.projects.get(projectId);}
  async saveProject(ledger: ProjectCostLedger) {this.projects.set(ledger.projectId, structuredClone(ledger));}
  async getMonth(month: string, limitUsd: number): Promise<AIMonthlyBudget> {const entries = [...this.projects.values()].filter(({startedAt}) => startedAt.startsWith(month)); const spentUsd = entries.reduce((sum, item) => sum + item.totalCostUsd, 0); return {month, limitUsd, spentUsd, remainingUsd: Math.max(0, limitUsd - spentUsd), projectCount: entries.length};}
}
export const createLedger = (projectId: string, startedAt = new Date().toISOString()): ProjectCostLedger => ({projectId, startedAt, modelCalls: [], inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalCostUsd: 0});
export const appendModelCall = (ledger: ProjectCostLedger, call: AIModelCall): ProjectCostLedger => ({...ledger, modelCalls: [...ledger.modelCalls, call], inputTokens: ledger.inputTokens + call.inputTokens, cachedInputTokens: ledger.cachedInputTokens + call.cachedInputTokens, outputTokens: ledger.outputTokens + call.outputTokens, totalCostUsd: ledger.totalCostUsd + call.costUsd});
