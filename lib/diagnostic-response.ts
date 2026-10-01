import { DiagnosticDeliveryError } from './diagnostic-intake-client.ts';
import { LocalDatabaseUnavailableError } from './runtime-errors.ts';

const customerError = 'Die Analyse konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.';

export type DiagnosticFailure = {
  status: number;
  body: { error: string; code: string; retryWithNewSubmissionId?: true };
};

export function diagnosticFailure(error: unknown): DiagnosticFailure {
  if (error instanceof LocalDatabaseUnavailableError) {
    return { status: 503, body: { error: 'Die lokale Diagnostic-Datenbank ist nicht verfügbar.', code: 'local_database_unavailable' } };
  }
  if (error instanceof DiagnosticDeliveryError) {
    if (error.kind === 'configuration') {
      return { status: 503, body: { error: 'Die Diagnostic-Speicherung ist noch nicht konfiguriert.', code: 'diagnostic_intake_not_configured' } };
    }
    const body: DiagnosticFailure['body'] = {
      error: error.kind === 'rejected' ? 'Die Diagnostic wurde vom Speicherdienst abgelehnt.' : customerError,
      code: error.kind === 'rejected' ? 'diagnostic_intake_rejected' : 'diagnostic_intake_unavailable',
    };
    if (error.retryWithNewSubmissionId) body.retryWithNewSubmissionId = true;
    return { status: error.kind === 'rejected' ? (error.httpStatus || 422) : 503, body };
  }
  return { status: 400, body: { error: customerError, code: 'diagnostic_invalid_request' } };
}
