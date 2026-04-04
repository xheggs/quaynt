import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing, NAMESPACES } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages: Record<string, unknown> = {};
  for (const ns of NAMESPACES) {
    try {
      const mod = await import(`../../../locales/${locale}/${ns}.json`);
      Object.assign(messages, mod.default);
    } catch (error) {
      console.error(`[i18n] Failed to load namespace "${ns}" for locale "${locale}":`, error);
    }
  }

  return {
    locale,
    messages,
    timeZone: 'UTC',
  };
});
