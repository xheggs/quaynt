// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isDisposableEmail, PRIVACY_FORWARDER_ALLOWLIST } from './disposable-email-checker';

describe('isDisposableEmail', () => {
  it('flags a known disposable domain', () => {
    expect(isDisposableEmail('user@mailinator.com')).toBe(true);
  });

  it('flags 10minutemail', () => {
    expect(isDisposableEmail('throwaway@10minutemail.com')).toBe(true);
  });

  it('allows a real consumer domain', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
  });

  it('allows a real corporate domain', () => {
    expect(isDisposableEmail('founder@anthropic.com')).toBe(false);
  });

  it('is case-insensitive on the domain', () => {
    expect(isDisposableEmail('USER@MAILINATOR.COM')).toBe(true);
  });

  it('walks subdomains so foo.mailinator.com is also flagged', () => {
    expect(isDisposableEmail('user@foo.mailinator.com')).toBe(true);
  });

  it('allows Apple Hide My Email (privacy forwarder)', () => {
    expect(isDisposableEmail('abc123@privaterelay.appleid.com')).toBe(false);
  });

  it('allows DuckDuckGo Email Protection (privacy forwarder)', () => {
    expect(isDisposableEmail('myalias@duck.com')).toBe(false);
  });

  it('allows SimpleLogin (privacy forwarder)', () => {
    expect(isDisposableEmail('alias@simplelogin.com')).toBe(false);
  });

  it('returns false for input without an @', () => {
    expect(isDisposableEmail('garbage')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isDisposableEmail('')).toBe(false);
  });

  it('returns false for input with empty domain', () => {
    expect(isDisposableEmail('user@')).toBe(false);
  });

  it('exposes the privacy-forwarder allowlist as a Set', () => {
    expect(PRIVACY_FORWARDER_ALLOWLIST.has('privaterelay.appleid.com')).toBe(true);
    expect(PRIVACY_FORWARDER_ALLOWLIST.has('gmail.com')).toBe(false);
  });
});
