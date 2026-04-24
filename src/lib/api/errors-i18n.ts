import { IntlMessageFormat } from 'intl-messageformat';
import enErrors from '../../../locales/en/errors.json';
import { routing } from '@/lib/i18n/routing';

/**
 * Locale-aware error message resolver for API routes.
 *
 * API routes sit outside the `[locale]` segment of the Next.js app, so they
 * carry no request-scoped locale context and next-intl's `getTranslations`
 * helper cannot be used here. This resolver loads the errors namespace at
 * module-load and returns a `t(key, vars?)` function equivalent to the one
 * used in React pages. Supports ICU message syntax (placeholders, plurals).
 *
 * Usage:
 *   const t = await apiErrors();
 *   return badRequest(t('validation.required', { field: 'brandId' }));
 *   return notFound(t('resources.brand'));
 *
 * The helper is `async` for forward-compatibility: when Accept-Language
 * negotiation is added later, it will resolve the locale from the request
 * without changing any call site.
 */

type MessageValues = Record<string, string | number | Date>;

type TranslationMap = Record<string, unknown>;

const LOCALE_MESSAGES: Record<string, TranslationMap> = {
  en: (enErrors as { errors: TranslationMap }).errors,
};

function resolveKey(messages: TranslationMap, key: string): string | null {
  const parts = key.split('.');
  let cursor: unknown = messages;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as object)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof cursor === 'string' ? cursor : null;
}

export async function apiErrors(): Promise<(key: string, values?: MessageValues) => string> {
  const locale = routing.defaultLocale;
  const messages = LOCALE_MESSAGES[locale] ?? LOCALE_MESSAGES.en;

  return (key: string, values?: MessageValues): string => {
    const template = resolveKey(messages, key);
    if (template === null) {
      return key;
    }
    if (!values) {
      return template;
    }
    return new IntlMessageFormat(template, locale).format(values) as string;
  };
}
