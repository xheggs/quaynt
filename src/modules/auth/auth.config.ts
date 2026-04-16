import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins/magic-link';
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

function getDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  if (name && !email?.startsWith(name)) return name;
  if (!email) return 'User';
  const prefix = email.split('@')[0] ?? 'User';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),
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
      storage: 'memory',
      customRules: {
        '/sign-in/magic-link': { window: 60, max: 5 },
      },
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const displayName = getDisplayName(user.name, user.email);
              const name = `${displayName}'s Workspace`;
              const slug = generateWorkspaceSlug(displayName);
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
    plugins: [
      nextCookies(),
      magicLink({
        expiresIn: 600,
        disableSignUp: false,
        sendMagicLink: async ({ email, url }) => {
          const { createEmailTransport } =
            await import('@/modules/notifications/email/email.transport');

          let transport = null;
          try {
            transport = createEmailTransport();
          } catch {
            // SMTP not configured — fall through to console fallback
          }

          if (!transport) {
            console.log('[auth] ════════════════════════════════════════');
            console.log(`[auth] Magic link for ${email}`);
            console.log(`[auth] ${url}`);
            console.log('[auth] ════════════════════════════════════════');
            return;
          }

          const { loadEmailTranslations, t: tr } =
            await import('@/modules/notifications/notification.render');
          const { render } = await import('@react-email/render');
          const { MagicLinkEmail } =
            await import('@/modules/notifications/email/templates/magic-link');

          const translations = await loadEmailTranslations('en');
          const magicLinkT = (translations.magicLink ?? {}) as Record<string, unknown>;

          const element = MagicLinkEmail({
            url,
            locale: 'en',
            translations: {
              preview: tr(magicLinkT, 'preview'),
              heading: tr(magicLinkT, 'heading'),
              body: tr(magicLinkT, 'body'),
              buttonText: tr(magicLinkT, 'buttonText'),
              expiry: tr(magicLinkT, 'expiry'),
              ignoreNotice: tr(magicLinkT, 'ignoreNotice'),
            },
          }) as unknown as React.ReactElement;
          const html = await render(element);

          await transport.send({
            to: email,
            subject: tr(magicLinkT, 'subject'),
            html,
            text: `Sign in to Quaynt: ${url}`,
          });
        },
      }),
    ],
  });
}

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }
  return authInstance;
}
