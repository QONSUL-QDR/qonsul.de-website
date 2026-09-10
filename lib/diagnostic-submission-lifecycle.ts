export type SubmissionIdFactory = () => string;

/** A submission ID represents exactly one immutable Diagnostic payload. */
export function submissionIdForSave(current: string, create: SubmissionIdFactory): string {
  return current || create();
}

/** Any draft mutation starts a new logical submission. */
export function invalidateDraftSubmissionId(): '' {
  return '';
}
