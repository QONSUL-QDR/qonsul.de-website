import type { Metadata } from 'next';
import './globals.css';
import {setting} from '@/lib/server';
export function generateMetadata():Metadata { const origin=setting('PUBLIC_SITE_URL')||'http://localhost:3000'; const og=new URL('/og.png',origin).href; return {
  metadataBase: new URL(origin),
  title: 'QONSUL — Data · Quality · Risk',
  description: 'Qualität verstehen. Risiken vorausdenken. QONSUL verbindet Quality Engineering, technisches Risikomanagement und Data Science für die Produktentwicklung.',
  robots: { index: false, follow: false },
  icons:{icon:'/qonsul-logo.png'},
  openGraph: { title: 'QONSUL — Data · Quality · Risk', description: 'Qualität verstehen. Risiken vorausdenken. Datengetriebenes Qualitäts- und Risikomanagement für die Produktentwicklung.', locale: 'de_DE', type: 'website',images:[{url:og,alt:'QONSUL — Qualität verstehen. Risiken vorausdenken.'}] },
  twitter: { card: 'summary_large_image', title: 'QONSUL — Data · Quality · Risk', description: 'Qualität verstehen. Risiken vorausdenken. Datengetriebenes Qualitäts- und Risikomanagement für die Produktentwicklung.',images:[og] },
};}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}</body></html>; }
