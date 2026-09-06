function analyticsOrigin(): string | undefined {
  const endpoint = process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT;
  if (!endpoint) return undefined;

  try {
    const origin = new URL(endpoint).origin;

    return origin.startsWith('https://') ? origin : undefined;
  } catch {
    return undefined;
  }
}

export function websiteSecurityHeaders(): Array<[string, string]> {
  const connectSources = ["'self'", analyticsOrigin()].filter(Boolean).join(' ');
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  return [
    ['Content-Security-Policy', contentSecurityPolicy],
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()'],
  ];
}
