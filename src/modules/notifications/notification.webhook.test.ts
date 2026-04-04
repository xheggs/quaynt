// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    EMAIL_ENABLED: false,
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'https://app.quaynt.com',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock('./email/email.transport', () => ({
  createEmailTransport: vi.fn().mockReturnValue(null),
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>test</html>'),
  toPlainText: vi.fn().mockResolvedValue('test plain text'),
}));

const mockDispatchWebhookEvent = vi
  .fn()
  .mockResolvedValue({ eventId: 'we_1', deliveryIds: ['wd_1'] });

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
}));

const makeAlertEvent = (overrides = {}) => ({
  id: 'alertevt_1',
  workspaceId: 'ws_1',
  severity: 'warning',
  metricValue: '15.5',
  previousValue: '22.3',
  threshold: '20',
  condition: 'drops_below',
  scopeSnapshot: {
    brandId: 'brand_1',
    brandName: 'Acme Corp',
    platformName: 'ChatGPT',
    locale: 'en-US',
  },
  triggeredAt: new Date('2026-04-02T14:05:00Z'),
  alertRuleId: 'alert_1',
  ...overrides,
});

const makeRule = (overrides = {}) => ({
  id: 'alert_1',
  name: 'Recommendation share drop',
  metric: 'recommendation_share',
  severity: 'warning',
  ...overrides,
});

const defaultPref = {
  id: 'notificationPref_1',
  workspaceId: 'ws_1',
  userId: null,
  channel: 'webhook',
  enabled: true,
  digestFrequency: 'immediate',
  digestHour: 9,
  digestDay: 1,
  digestTimezone: 'UTC',
  severityFilter: ['info', 'warning', 'critical'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('dispatchAlertWebhook', () => {
  let dispatchAlertWebhook: typeof import('./notification.service').dispatchAlertWebhook;
  let boss: { send: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    boss = { send: vi.fn() };

    // Reset module to get fresh import
    const mod = await import('./notification.service');
    dispatchAlertWebhook = mod.dispatchAlertWebhook;
  });

  function mockPreferenceQuery(pref: typeof defaultPref | undefined) {
    // getOrCreateWorkspacePreference: select → from → where → limit
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(pref ? [pref] : []),
        }),
      }),
    });

    // If no preference exists, it will try to insert one
    if (!pref) {
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([defaultPref]),
          }),
        }),
      });
    }
  }

  function mockEndpointQuery(endpoints: Array<{ id: string; url: string }>) {
    // Endpoint query after dispatchWebhookEvent
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(endpoints),
      }),
    });
  }

  function mockNotificationLogInsert() {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
  }

  it('dispatches webhook when preference is enabled and severity matches', async () => {
    mockPreferenceQuery(defaultPref);
    mockEndpointQuery([{ id: 'ep_1', url: 'https://hooks.example.com/webhook' }]);
    mockNotificationLogInsert();

    await dispatchAlertWebhook(makeAlertEvent(), makeRule(), boss as unknown as PgBoss);

    expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
      'ws_1',
      'alert.triggered',
      expect.objectContaining({
        alert: expect.objectContaining({
          ruleId: 'alert_1',
          ruleName: 'Recommendation share drop',
          summary: expect.stringContaining('Acme Corp'),
          url: expect.stringContaining('/api/v1/alerts/events/alertevt_1/view'),
        }),
      }),
      boss
    );
  });

  it('creates default-enabled preference on first dispatch (backwards compatibility)', async () => {
    // No existing preference
    mockPreferenceQuery(undefined);
    mockEndpointQuery([{ id: 'ep_1', url: 'https://hooks.example.com/webhook' }]);
    mockNotificationLogInsert();

    await dispatchAlertWebhook(makeAlertEvent(), makeRule(), boss as unknown as PgBoss);

    expect(mockDispatchWebhookEvent).toHaveBeenCalled();
  });

  it('skips dispatch when preference is disabled', async () => {
    mockPreferenceQuery({ ...defaultPref, enabled: false });

    await dispatchAlertWebhook(makeAlertEvent(), makeRule(), boss as unknown as PgBoss);

    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('skips dispatch when severity is not in filter', async () => {
    mockPreferenceQuery({ ...defaultPref, severityFilter: ['critical'] });

    await dispatchAlertWebhook(
      makeAlertEvent({ severity: 'info' }),
      makeRule(),
      boss as unknown as PgBoss
    );

    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('creates notification_log entry per endpoint with status pending', async () => {
    const endpoints = [
      { id: 'ep_1', url: 'https://hooks.example.com/webhook' },
      { id: 'ep_2', url: 'https://pagerduty.example.com/webhook' },
    ];
    mockPreferenceQuery(defaultPref);
    mockEndpointQuery(endpoints);
    mockNotificationLogInsert();

    await dispatchAlertWebhook(makeAlertEvent(), makeRule(), boss as unknown as PgBoss);

    // Should have inserted notification_log for each endpoint
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('enriched payload includes summary and url fields', async () => {
    mockPreferenceQuery(defaultPref);
    mockEndpointQuery([{ id: 'ep_1', url: 'https://hooks.example.com/webhook' }]);
    mockNotificationLogInsert();

    await dispatchAlertWebhook(makeAlertEvent(), makeRule(), boss as unknown as PgBoss);

    const dispatchCall = mockDispatchWebhookEvent.mock.calls[0];
    const payload = dispatchCall[2];
    expect(payload.alert.summary).toContain('Warning');
    expect(payload.alert.summary).toContain('Acme Corp');
    expect(payload.alert.summary).toContain('Recommendation share');
    expect(payload.alert.url).toBe('https://app.quaynt.com/api/v1/alerts/events/alertevt_1/view');
  });

  it('handles dispatchWebhookEvent failure gracefully', async () => {
    mockPreferenceQuery(defaultPref);
    mockDispatchWebhookEvent.mockRejectedValueOnce(new Error('Webhook dispatch failed'));

    await expect(
      dispatchAlertWebhook(makeAlertEvent(), makeRule(), boss as unknown as PgBoss)
    ).rejects.toThrow('Webhook dispatch failed');
  });
});
