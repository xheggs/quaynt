import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg-boss', 'pg', 'pino', 'pino-pretty'],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
    {
      source: '/snippet/:version/:file*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=3600' },
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
      ],
    },
  ],
};

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

export default withNextIntl(nextConfig);
