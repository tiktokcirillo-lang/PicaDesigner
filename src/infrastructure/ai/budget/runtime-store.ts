import type { BudgetStore } from "./budget-tracker.js";
import { InMemoryBudgetStore } from "./stores/in-memory-budget-store.js";
import { UnavailableBudgetStore } from "./stores/unavailable-budget-store.js";
import { UpstashBudgetStore } from "./stores/upstash-budget-store.js";

export interface DurableBudgetStore extends BudgetStore {
  readonly kind: "durable";
  readonly atomicReservations: true;
}
export const createBudgetStore = (
  env: NodeJS.ProcessEnv = process.env,
): BudgetStore => {
  const redis = UpstashBudgetStore.fromEnv(env);
  if (redis) return redis;
  const production = env.NODE_ENV === "production",
    allowMemory =
      (env.AI_ALLOW_INMEMORY_BUDGET ?? "false").toLowerCase() === "true";
  return production && !allowMemory
    ? new UnavailableBudgetStore()
    : new InMemoryBudgetStore();
};
export const applicationBudgetStore: BudgetStore = createBudgetStore();
