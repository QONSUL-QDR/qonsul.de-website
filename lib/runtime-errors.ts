export class LocalDatabaseUnavailableError extends Error {
  constructor() {
    super('Local D1 binding is unavailable.');
    this.name = 'LocalDatabaseUnavailableError';
  }
}
