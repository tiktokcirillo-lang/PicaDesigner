import { applicationBudgetStore } from "../../infrastructure/ai/budget/runtime-store.js";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import { PersistenceUnavailableError } from "../../domain/project-persistence/index.js";

export async function assertPaidAISinkReadiness() {
  const [project, budget] = await Promise.all([
    applicationProjectRepository.health(),
    applicationBudgetStore.health(),
  ]);
  if (
    project.status !== "ok" ||
    project.kind === "unavailable" ||
    budget.status !== "ok" ||
    !budget.atomicReservations
  )
    throw new PersistenceUnavailableError("Durable AI sinks are unavailable.");
}
