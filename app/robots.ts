import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { PRODUCTION_SITE_ORIGIN, isIndexableSiteRequest } from '@/lib/site-indexing';
import { setting } from '@/lib/server';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const indexable = isIndexableSiteRequest(
    setting('PUBLIC_SITE_URL'),
    requestHeaders.get('host'),
  );

  if (!indexable) return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/anfrage-verwalten/', '/report'],
    },
    sitemap: `${PRODUCTION_SITE_ORIGIN}/sitemap.xml`,
    host: PRODUCTION_SITE_ORIGIN,
  };
}
