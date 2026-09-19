import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { articles, services } from '@/lib/content';
import { PRODUCTION_SITE_ORIGIN, isIndexableSiteRequest } from '@/lib/site-indexing';
import { setting } from '@/lib/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  if (!isIndexableSiteRequest(setting('PUBLIC_SITE_URL'), requestHeaders.get('host'))) return [];

  return [
    { url: PRODUCTION_SITE_ORIGIN, changeFrequency: 'monthly', priority: 1 },
    { url: `${PRODUCTION_SITE_ORIGIN}/impressum`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${PRODUCTION_SITE_ORIGIN}/datenschutz`, changeFrequency: 'yearly', priority: 0.3 },
    ...services.map(({ slug }) => ({
      url: `${PRODUCTION_SITE_ORIGIN}/leistungen/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...articles.map(({ slug }) => ({
      url: `${PRODUCTION_SITE_ORIGIN}/insights/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
