export const CONSULTATION_CORRECTION_STORAGE_KEY = 'qonsul-consultation-correction';

export type ConsultationCorrectionLink = { path: string; expiresAt: number };

export function readConsultationCorrectionLink(now = Date.now()): ConsultationCorrectionLink | null {
  try {
    const raw = localStorage.getItem(CONSULTATION_CORRECTION_STORAGE_KEY);
    const stored = JSON.parse(raw || 'null') as Partial<ConsultationCorrectionLink> | null;
    if (!stored || typeof stored.path !== 'string' || typeof stored.expiresAt !== 'number' || stored.expiresAt <= now) {
      localStorage.removeItem(CONSULTATION_CORRECTION_STORAGE_KEY);
      return null;
    }
    return { path: stored.path, expiresAt: stored.expiresAt };
  } catch {
    localStorage.removeItem(CONSULTATION_CORRECTION_STORAGE_KEY);
    return null;
  }
}

export function storeConsultationCorrectionLink(path: string, now = Date.now()): ConsultationCorrectionLink {
  const value = { path, expiresAt: now + 7 * 24 * 60 * 60 * 1000 };
  localStorage.setItem(CONSULTATION_CORRECTION_STORAGE_KEY, JSON.stringify(value));
  return value;
}
