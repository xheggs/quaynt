import createMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except:
  // - /api (API routes handle locale via Accept-Language header)
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - files with extensions (e.g., favicon.ico, robots.txt)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
