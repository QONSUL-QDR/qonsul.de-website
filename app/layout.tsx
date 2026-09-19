import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { AnalyticsClient } from './analytics-client';
import { AnalyticsConsent } from './analytics-consent';
import { PRODUCTION_SITE_ORIGIN, isIndexableSiteRequest, resolveMetadataOrigin } from '@/lib/site-indexing';
import { setting } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const configuredOrigin = setting('PUBLIC_SITE_URL');
  const indexable = isIndexableSiteRequest(configuredOrigin, requestHeaders.get('host'));
  const metadataOrigin = indexable ? PRODUCTION_SITE_ORIGIN : resolveMetadataOrigin(configuredOrigin);
  const og = new URL('/og.png', metadataOrigin).href;

  return {
    metadataBase: new URL(metadataOrigin),
    title: 'QONSUL — Data · Quality · Risk',
    description: 'Qualität verstehen. Risiken vorausdenken. QONSUL verbindet Quality Engineering, technisches Risikomanagement und Data Science für die Produktentwicklung.',
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    icons: { icon: '/qonsul-logo-selected.png' },
    openGraph: { title: 'QONSUL — Data · Quality · Risk', description: 'Qualität verstehen. Risiken vorausdenken. Datengetriebenes Qualitäts- und Risikomanagement für die Produktentwicklung.', locale: 'de_DE', type: 'website', images: [{ url: og, alt: 'QONSUL — Qualität verstehen. Risiken vorausdenken.' }] },
    twitter: { card: 'summary_large_image', title: 'QONSUL — Data · Quality · Risk', description: 'Qualität verstehen. Risiken vorausdenken. Datengetriebenes Qualitäts- und Risikomanagement für die Produktentwicklung.', images: [og] },
  };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body><AnalyticsClient />{children}<AnalyticsConsent /></body></html>; }
