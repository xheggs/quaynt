import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins/magic-link';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { generatePrefixedId, generateId, PREFIXES } from '@/lib/db/id';
import { isDisposableEmail } from '@/lib/email/disposable-email-checker';
import * as authSchema from './auth.schema';
import {
  createWorkspaceForUserTx,
  generateWorkspaceSlug,
} from '@/modules/workspace/workspace.service';
import { seedStarter } from '@/modules/prompt-sets/prompt-set.service';
import { initialize as initializeOnboarding } from '@/modules/onboarding/onboarding.service';
import { OnboardingEvent, emitOnboardingEvent } from '@/modules/telemetry/onboarding-events';

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
          before: async (user) => {
            if (user.email && isDisposableEmail(user.email)) {
              throw new APIError('BAD_REQUEST', {
                code: 'DISPOSABLE_EMAIL',
                message: 'Disposable email addresses are not allowed',
              });
            }
          },
          after: async (user) => {
            const displayName = getDisplayName(user.name, user.email);
            const name = `${displayName}'s Workspace`;
            const slug = generateWorkspaceSlug(displayName);

            // Atomic signup-side seeding: workspace + starter prompt set +
            // onboarding row. Any failure rolls back the whole transaction so
            // a partial state cannot persist. Errors are rethrown — Better
            // Auth surfaces a generic sign-in failure and the user retries.
            const workspaceId = await db.transaction(async (tx) => {
              const ws = await createWorkspaceForUserTx(tx, user.id, name, slug);
              await seedStarter(tx, ws.id);
              await initializeOnboarding(tx, ws.id);
              return ws.id;
            });

            // Telemetry: emitted post-commit so we never log a signup that
            // ultimately rolled back. The transaction is the dedup boundary —
            // if Better Auth retries the user create after a failure, the
            // workspace insert hits its unique constraint and rolls back.
            emitOnboardingEvent(OnboardingEvent.signedUp, {
              workspaceId,
              userId: user.id,
            });
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
          // Reject disposable addresses up front so we never spend an SMTP
          // delivery on them. The user.create.before hook is a second line
          // of defense in case other sign-up paths are added later.
          if (isDisposableEmail(email)) {
            throw new APIError('BAD_REQUEST', {
              code: 'DISPOSABLE_EMAIL',
              message: 'Disposable email addresses are not allowed',
            });
          }

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
          const brandT = (translations.brand ?? {}) as Record<string, unknown>;

          const element = MagicLinkEmail({
            url,
            appUrl: env.BETTER_AUTH_URL,
            privacyUrl: `${env.BETTER_AUTH_URL}/privacy`,
            locale: 'en',
            translations: {
              preview: tr(magicLinkT, 'preview'),
              eyebrow: tr(magicLinkT, 'eyebrow'),
              heading: tr(magicLinkT, 'heading'),
              body: tr(magicLinkT, 'body'),
              buttonText: tr(magicLinkT, 'buttonText'),
              fallbackIntro: tr(magicLinkT, 'fallbackIntro'),
              sentToNotice: tr(magicLinkT, 'sentToNotice', { email }),
              tagline: tr(brandT, 'tagline'),
              privacy: tr(magicLinkT, 'privacy'),
            },
          }) as unknown as React.ReactElement;
          const html = await render(element);
          const { toPlainText } = await import('@react-email/render');
          const text = toPlainText(html);

          await transport.send({
            to: email,
            subject: tr(magicLinkT, 'subject'),
            html,
            text,
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
