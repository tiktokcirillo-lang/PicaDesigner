import {createLedger, type BudgetStore} from './budget-tracker.js';

export class ProjectAIBudgetCoordinator {
  constructor(private readonly store: BudgetStore) {}
  async ledger(projectId: string) {return await this.store.getProject(projectId) ?? createLedger(projectId);}
  get budgetStore() {return this.store;}
}
