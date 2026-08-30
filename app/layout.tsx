import type { Metadata } from 'next';
import './globals.css';
import {setting} from '@/lib/server';
export function generateMetadata():Metadata { const origin=setting('PUBLIC_SITE_URL')||'http://localhost:3000'; const og=new URL('/og.png',origin).href; return {
  metadataBase: new URL(origin),
  title: 'Qonsul — Data-Driven Quality Engineering',
  description: 'Weniger Fehlersuche. Mehr Fortschritt. Analysieren Sie Qualitätsprobleme im interaktiven Ishikawa-Board.',
  robots: { index: false, follow: false },
  icons:{icon:'/qonsul-logo.png'},
  openGraph: { title: 'Qonsul — Data-Driven Quality Engineering', description: 'Weniger Fehlersuche. Mehr Fortschritt.', locale: 'de_DE', type: 'website',images:[{url:og,alt:'Qonsul — Weniger Fehlersuche. Mehr Fortschritt.'}] },
  twitter: { card: 'summary_large_image', title: 'Qonsul — Data-Driven Quality Engineering', description: 'Weniger Fehlersuche. Mehr Fortschritt.',images:[og] },
};}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}</body></html>; }
