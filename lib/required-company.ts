export function requiredCompany(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 150) {
    throw new Error('Bitte geben Sie Ihr Unternehmen an.');
  }

  return value.trim();
}
