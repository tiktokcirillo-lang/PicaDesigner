export class PersistenceError extends Error {}
export class PersistenceUnavailableError extends PersistenceError {}
export class InvalidDurablePayloadError extends PersistenceError {}
export class OptimisticConcurrencyError extends PersistenceError {
  readonly statusCode = 409;
  constructor() {
    super("Project revision conflict. Reload server state before saving.");
  }
}
export class ProductionAuthorityPersistenceError extends PersistenceError {}
