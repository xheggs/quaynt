import type { SuggestionError } from '../../api/suggest';

export type ErrorMessageKey =
  | 'fetchFailed'
  | 'robotsDisallow'
  | 'engineUnavailable'
  | 'engineRateLimited'
  | 'engineResponseInvalid'
  | 'timeout';

export function errorKeyFor(error: SuggestionError | null | undefined): ErrorMessageKey {
  if (!error) return 'fetchFailed';
  switch (error.code) {
    case 'robots_disallow':
      return 'robotsDisallow';
    case 'engine_unavailable':
      return 'engineUnavailable';
    case 'engine_rate_limited':
      return 'engineRateLimited';
    case 'engine_response_invalid':
      return 'engineResponseInvalid';
    case 'engine_timeout':
    case 'timeout':
      return 'timeout';
    default:
      return 'fetchFailed';
  }
}
