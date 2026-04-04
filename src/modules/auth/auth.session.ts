import { headers } from 'next/headers';
import { getAuth } from './auth.config';

export async function getServerSession() {
  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireServerSession() {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Unauthorized: no active session');
  }
  return session;
}
