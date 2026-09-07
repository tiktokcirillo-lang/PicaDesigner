import {InMemoryBudgetStore, type BudgetStore} from './budget-tracker.js';

export interface DurableBudgetStore extends BudgetStore {}
export const applicationBudgetStore: BudgetStore = new InMemoryBudgetStore();
