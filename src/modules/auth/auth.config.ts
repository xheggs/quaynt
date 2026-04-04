import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { generatePrefixedId, generateId, PREFIXES } from '@/lib/db/id';
import * as authSchema from './auth.schema';
import {
  createWorkspaceForUser,
  generateWorkspaceSlug,
} from '@/modules/workspace/workspace.service';

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: 'compact',
      },
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'database',
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
      },
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const name = user.name ? `${user.name}'s Workspace` : 'My Workspace';
              const slug = generateWorkspaceSlug(user.name ?? user.email ?? 'workspace');
              await createWorkspaceForUser(user.id, name, slug);
            } catch (error) {
              console.error(
                `[auth] Failed to create default workspace for user ${user.id}:`,
                error
              );
            }
          },
        },
      },
    },
    advanced: {
      database: {
        generateId: ({ model }) => {
          if (model in PREFIXES) {
            return generatePrefixedId(model as keyof typeof PREFIXES);
          }
          return generateId(model);
        },
      },
    },
    plugins: [nextCookies()],
  });
}

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }
  return authInstance;
}
