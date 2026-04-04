import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

async function handler(request: NextRequest) {
  const { getAuth } = await import('@/modules/auth/auth.config');
  const { toNextJsHandler } = await import('better-auth/next-js');
  const { GET: get, POST: post } = toNextJsHandler(getAuth());
  if (request.method === 'POST') {
    return post(request);
  }
  return get(request);
}

export { handler as GET, handler as POST };
