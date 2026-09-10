export type SubmissionIdFactory = () => string;

/** A submission ID represents exactly one immutable Diagnostic payload. */
export function submissionIdForSave(current: string, create: SubmissionIdFactory): string {
  return current || create();
}

/** Any draft mutation starts a new logical submission. */
export function invalidateDraftSubmissionId(): '' {
  return '';
}

export async function withSavingState<T>(setSaving: (saving: boolean) => void, operation: () => Promise<T>): Promise<T> {
  setSaving(true);
  try {
    return await operation();
  } finally {
    setSaving(false);
  }
}
