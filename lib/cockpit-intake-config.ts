export type CockpitIntakeConfig = { baseUrl: string; secret: string };

export function isCockpitIntakeConfigured(config: CockpitIntakeConfig): boolean {
  if (config.secret.length < 32) return false;
  try {
    const url = new URL(config.baseUrl);
    return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}
