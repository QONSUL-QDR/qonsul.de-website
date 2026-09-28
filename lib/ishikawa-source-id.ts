const bytes = (value: string) => new TextEncoder().encode(value);

/**
 * Produces a stable UUID for a cause in a persisted Ishikawa report.
 *
 * The Cockpit contract requires a UUID source_cause_id, while the website's
 * UI uses concise local identifiers such as "cause-0". Deriving the UUID from
 * the immutable report id and local cause id preserves retry safety without
 * adding another persisted identifier to the report schema.
 */
export async function ishikawaSourceCauseId(reportId: string, causeId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    bytes(`qonsul-ishikawa-source-cause-v1:${reportId}:${causeId}`),
  ));

  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest.subarray(0, 16)].map(value => value.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
