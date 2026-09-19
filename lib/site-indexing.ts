export const PRODUCTION_SITE_ORIGIN = 'https://qonsul.de';
export const PRODUCTION_SITE_HOST = 'qonsul.de';

const NON_PUBLIC_PATH_PREFIXES = ['/api/', '/anfrage-verwalten/', '/report'];

function isProductionSiteConfiguration(configuredSiteUrl: string): boolean {
  try {
    const configured = new URL(configuredSiteUrl);

    return (
      configured.origin === PRODUCTION_SITE_ORIGIN &&
      configured.pathname === '/' &&
      configured.search === '' &&
      configured.hash === '' &&
      configured.username === '' &&
      configured.password === ''
    );
  } catch {
    return false;
  }
}

function normalizeRequestHost(requestHost: string | null): string | null {
  if (!requestHost || requestHost.includes(',') || /[\s/@\\]/.test(requestHost)) return null;

  try {
    const parsed = new URL(`https://${requestHost.toLowerCase()}`);
    if (parsed.port && parsed.port !== '443') return null;

    return parsed.hostname;
  } catch {
    return null;
  }
}

export function isIndexableSiteRequest(configuredSiteUrl: string, requestHost: string | null): boolean {
  return (
    isProductionSiteConfiguration(configuredSiteUrl) &&
    normalizeRequestHost(requestHost) === PRODUCTION_SITE_HOST
  );
}

export function resolveMetadataOrigin(configuredSiteUrl: string): string {
  try {
    const configured = new URL(configuredSiteUrl);
    if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password) {
      return 'http://localhost:3000';
    }

    return configured.origin;
  } catch {
    return 'http://localhost:3000';
  }
}

export function isPublicIndexablePath(pathname: string): boolean {
  return !NON_PUBLIC_PATH_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldSendNoIndexHeader(configuredSiteUrl: string, requestUrl: string): boolean {
  try {
    const request = new URL(requestUrl);

    return (
      request.protocol !== 'https:' ||
      !isIndexableSiteRequest(configuredSiteUrl, request.host) ||
      !isPublicIndexablePath(request.pathname)
    );
  } catch {
    return true;
  }
}
