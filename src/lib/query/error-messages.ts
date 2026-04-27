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
  // Validation failures carry per-field messages in `details`. Surface the
  // first one — it's actionable (e.g. "Number must be greater than 0") —
  // rather than the generic "The request could not be processed".
  if (error.code === 'UNPROCESSABLE_ENTITY' && error.details && error.details.length > 0) {
    return error.details[0].message;
  }
  // If the server supplied a specific human message distinct from the machine
  // code (e.g. "Brand name already exists in this workspace"), prefer it. It
  // is more actionable than the generic localized template.
  if (error.message && error.message !== error.code) {
    return error.message;
  }
  const key = CODE_TO_KEY[error.code];
  if (key) {
    return t(key);
  }
  return t('unknown');
}
