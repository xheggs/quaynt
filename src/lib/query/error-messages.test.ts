import { describe, expect, it } from 'vitest';
import { translateApiError } from './error-messages';
import { ApiError } from './types';

const stubT = (key: string) => `t(${key})`;

describe('translateApiError', () => {
  it('prefers the first details message for UNPROCESSABLE_ENTITY', () => {
    const err = new ApiError('UNPROCESSABLE_ENTITY', 'UNPROCESSABLE_ENTITY', 422, [
      { field: 'order', message: 'Number must be greater than or equal to 0' },
      { field: 'template', message: 'Required' },
    ]);
    expect(translateApiError(stubT, err)).toBe('Number must be greater than or equal to 0');
  });

  it('falls back to the localized code when UNPROCESSABLE_ENTITY has no details', () => {
    const err = new ApiError('UNPROCESSABLE_ENTITY', 'UNPROCESSABLE_ENTITY', 422);
    expect(translateApiError(stubT, err)).toBe('t(unprocessable)');
  });

  it('falls back to the localized code when details is empty', () => {
    const err = new ApiError('UNPROCESSABLE_ENTITY', 'UNPROCESSABLE_ENTITY', 422, []);
    expect(translateApiError(stubT, err)).toBe('t(unprocessable)');
  });

  it('translates known codes via the namespace when message equals the code', () => {
    expect(translateApiError(stubT, new ApiError('CONFLICT', 'CONFLICT', 409))).toBe('t(conflict)');
    expect(translateApiError(stubT, new ApiError('NETWORK_ERROR', 'NETWORK_ERROR', 0))).toBe(
      't(networkError)'
    );
  });

  it('prefers server-supplied human messages over the localized code', () => {
    const err = new ApiError('CONFLICT', 'Brand name already exists in this workspace', 409);
    expect(translateApiError(stubT, err)).toBe('Brand name already exists in this workspace');
  });

  it('falls back to t(unknown) for unrecognized codes with no message', () => {
    const err = new ApiError('CUSTOM_CODE', 'CUSTOM_CODE', 418);
    expect(translateApiError(stubT, err)).toBe('t(unknown)');
  });
});
