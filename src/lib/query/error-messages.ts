import type { ApiError } from './types';

// Accepts the next-intl translator for the `errors.api` namespace. Typed as
// `unknown` here because next-intl's Translator type has literal-typed keys
// that would force this helper to depend on the generated message schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorsApiTranslator = (key: any) => string;

const CODE_TO_KEY: Record<string, string> = {
  BAD_REQUEST: 'badRequest',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  UNPROCESSABLE_ENTITY: 'unprocessable',
  TOO_MANY_REQUESTS: 'tooManyRequests',
  INTERNAL_SERVER_ERROR: 'internalError',
  NETWORK_ERROR: 'networkError',
  UNKNOWN: 'unknown',
};

/**
 * Maps an ApiError to a localized message using the `errors.api` namespace.
 *
 * If the server returned a message that is not one of the known machine
 * codes, that message is assumed to already be localized (or caller-supplied)
 * and is returned as-is. Otherwise, the code is translated via the supplied
 * next-intl translator.
 */
export function translateApiError(t: ErrorsApiTranslator, error: ApiError): string {
  const key = CODE_TO_KEY[error.code];
  if (key) {
    return t(key);
  }
  if (error.message && error.message !== error.code) {
    return error.message;
  }
  return t('unknown');
}
