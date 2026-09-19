import { type NextRequest, NextResponse } from 'next/server';
import { websiteSecurityHeaders } from './lib/security-headers';
import { shouldSendNoIndexHeader } from './lib/site-indexing';
import { setting } from './lib/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  for (const [key, value] of websiteSecurityHeaders()) response.headers.set(key, value);
  if (shouldSendNoIndexHeader(setting('PUBLIC_SITE_URL'), request.url)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = { matcher: '/:path*' };
