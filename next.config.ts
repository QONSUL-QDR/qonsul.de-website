import type { NextConfig } from 'next';
import { websiteSecurityHeaders } from './lib/security-headers';

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: websiteSecurityHeaders().map(([key, value]) => ({ key, value })) }];
  },
};

export default nextConfig;
