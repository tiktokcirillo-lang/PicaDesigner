import { AIProviderError } from "../../providers/errors.js";
import type { BudgetStore } from "../budget-tracker.js";
export class UnavailableBudgetStore implements BudgetStore {
  readonly kind = "unavailable" as const;
  readonly atomicReservations = false;
  private fail(): never {
    throw new AIProviderError("AI budget service temporarily unavailable.");
  }
  async getProject() {
    return this.fail();
  }
  async saveProject() {
    return this.fail();
  }
  async getMonth() {
    return this.fail();
  }
  async reserve() {
    return this.fail();
  }
  async commit() {
    return this.fail();
  }
  async release() {
    return this.fail();
  }
  async resolveUnknown() {
    return this.fail();
  }
  async getOperationResult() {
    return this.fail();
  }
  async getOperationState() {
    return this.fail();
  }
  async saveOperationResult() {
    return this.fail();
  }
  async getUsageSnapshot() {
    return this.fail();
  }
  async health() {
    return {
      status: "degraded" as const,
      store: "memory" as const,
      atomicReservations: false,
    };
  }
}
