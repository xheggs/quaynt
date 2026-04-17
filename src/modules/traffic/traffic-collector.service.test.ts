// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked site-key lookup — the test drives the scenarios via mockImplementation.
const mockGetSiteKeyByPlaintext = vi.fn();
vi.mock('./traffic-site-key.service', () => ({
  getSiteKeyByPlaintext: mockGetSiteKeyByPlaintext,
}));

const mockInsertVisit = vi.fn();
vi.mock('./ai-visit.service', () => ({
  insertVisit: mockInsertVisit,
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }) },
}));

describe('traffic-collector.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertVisit.mockResolvedValue(undefined);
  });

  it('rejects invalid site keys (returns invalid_site_key)', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce(null);
    const { collectVisit } = await import('./traffic-collector.service');

    const result = await collectVisit({
      siteKeyPlaintext: 'tsk_invalid',
      payload: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
      userAgent: 'Mozilla/5.0',
      requestOrigin: 'https://acme.com',
    });

    expect(result).toEqual({ accepted: false, reason: 'invalid_site_key' });
    expect(mockInsertVisit).not.toHaveBeenCalled();
  });

  it('rejects when Origin is not in allowedOrigins', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: ['https://acme.com'],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    const result = await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
      userAgent: 'Mozilla/5.0',
      requestOrigin: 'https://evil.com',
    });

    expect(result).toEqual({ accepted: false, reason: 'origin_not_allowed' });
    expect(mockInsertVisit).not.toHaveBeenCalled();
  });

  it('accepts when allowedOrigins is empty regardless of Origin', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: [],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    const result = await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
      requestOrigin: 'https://anywhere.com',
    });

    expect(result.accepted).toBe(true);
    expect(result.platform).toBe('chatgpt');
    expect(mockInsertVisit).toHaveBeenCalledOnce();
  });

  it('drops bot user agents silently', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: [],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    const result = await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
      userAgent: 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
      requestOrigin: null,
    });

    expect(result).toEqual({ accepted: false, reason: 'bot_user_agent' });
    expect(mockInsertVisit).not.toHaveBeenCalled();
  });

  it('drops non-AI referrers silently', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: [],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    const result = await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: { referrer: 'https://example.com', landingPath: '/blog' },
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      requestOrigin: null,
    });

    expect(result).toEqual({ accepted: false, reason: 'not_ai_source' });
    expect(mockInsertVisit).not.toHaveBeenCalled();
  });

  it('falls back to utm_source when referrer is missing', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: [],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    const result = await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: { referrer: null, landingPath: '/blog?utm_source=chatgpt.com' },
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      requestOrigin: null,
    });

    expect(result.accepted).toBe(true);
    expect(result.platform).toBe('chatgpt');
    expect(mockInsertVisit).toHaveBeenCalledOnce();
  });

  it('NEVER persists IP, session hash, cookie id, or full user-agent', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: [],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 (unique-fingerprint)',
      requestOrigin: null,
    });

    expect(mockInsertVisit).toHaveBeenCalledOnce();
    const insertedRow = mockInsertVisit.mock.calls[0][0];
    expect(insertedRow).not.toHaveProperty('ip');
    expect(insertedRow).not.toHaveProperty('ipAddress');
    expect(insertedRow).not.toHaveProperty('sessionHash');
    expect(insertedRow).not.toHaveProperty('sessionId');
    expect(insertedRow).not.toHaveProperty('cookieId');
    expect(insertedRow).not.toHaveProperty('userAgent'); // only userAgentFamily
    expect(insertedRow.userAgentFamily).toBe('Chrome');
  });

  it('stores the referrer host (not the full URL) and the landing path verbatim', async () => {
    mockGetSiteKeyByPlaintext.mockResolvedValueOnce({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      allowedOrigins: [],
    });
    const { collectVisit } = await import('./traffic-collector.service');

    await collectVisit({
      siteKeyPlaintext: 'tsk_valid',
      payload: {
        referrer: 'https://chatgpt.com/c/xyz?id=secret',
        landingPath: '/pricing?utm_source=chatgpt.com',
      },
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      requestOrigin: null,
    });

    const insertedRow = mockInsertVisit.mock.calls[0][0];
    expect(insertedRow.referrerHost).toBe('chatgpt.com');
    expect(insertedRow.landingPath).toBe('/pricing?utm_source=chatgpt.com');
    expect(insertedRow.source).toBe('snippet');
  });
});
