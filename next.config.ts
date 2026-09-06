import type { NextConfig } from 'next';

// Security-Header-Baseline für die Cloudflare-Workers-Auslieferung.
//
// - Keine externen Skripte/Fonts im Code (kein Google-Fonts-Import, keine externen <script>-Tags,
//   kein dangerouslySetInnerHTML) — alle Assets (Hero-Bilder, Logo, OG-Bild) sind self-hosted.
// - `script-src`/`style-src` brauchen dennoch 'unsafe-inline': Vinext (die Vite-basierte
//   Next.js-kompatible Laufzeit dieses Projekts) injiziert beim RSC-Hydration-Bootstrap Inline-Skripte,
//   und mehrere Komponenten nutzen React-Inline-Styles (style={{...}}). Ein Nonce-basiertes CSP wäre
//   strenger, ist aber nicht gegen Vinext' Hydration-Mechanismus verifiziert (kein next/csp-Äquivalent
//   im Vinext-Quellcode gefunden) — daher hier bewusst konservativ mit 'unsafe-inline', statt eine
//   möglicherweise falsche Nonce-Implementierung zu riskieren, die die Seite unbenutzbar macht.
// - `connect-src`: OpenAI/Resend/HubSpot/Cockpit-Intake werden ausschließlich serverseitig
//   (Worker → API) aufgerufen, nie per Browser-Fetch. Die Phase-4-Analytics-Instrumentierung
//   (app/analytics-client.tsx) sendet Events dagegen direkt aus dem Browser an
//   NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT (Cockpit-Analytics-API) — deshalb wird dessen Origin hier
//   zur Build-Zeit aus derselben Env-Variable abgeleitet, statt eine feste Staging-/Production-URL
//   hart zu kodieren. Ohne gesetzte Variable (z. B. lokal/CI) bleibt es bei 'self'.
// - Getestet gegen `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build`
//   (alle grün) in einem isolierten Klon, *nicht* gegen ein echtes Browser-Rendering (wrangler dev/
//   Cloudflare-Netzwerk aus dieser Cloud-Sitzung heraus nicht erreichbar). Vor dem produktiven Einsatz:
//   einmal auf der Testumgebung öffnen und die Browser-Konsole auf CSP-Verstöße prüfen (F12 → Console).
function analyticsOrigin(): string | undefined {
  const endpoint = process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT;
  if (!endpoint) return undefined;
  try {
    return new URL(endpoint).origin;
  } catch {
    return undefined;
  }
}

const connectSrc = ["'self'", analyticsOrigin()].filter(Boolean).join(' ');

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
  `connect-src ${connectSrc}`,
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // vinext's route matcher treats ':path*' as requiring at least one segment (unlike
        // upstream Next.js, where '*' also matches zero segments) — verified locally: without
        // this explicit '/' entry, every route got the security headers except the homepage
        // itself. Keep both entries until that matcher gap is fixed upstream.
        source: '/',
        headers: securityHeaders,
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
