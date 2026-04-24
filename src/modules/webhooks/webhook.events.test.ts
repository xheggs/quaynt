import { describe, it, expect } from 'vitest';
import { WEBHOOK_EVENT_TYPES, WEBHOOK_SAMPLE_PAYLOADS } from './webhook.events';
import type { WebhookEventType } from './webhook.events';

describe('webhook event registry', () => {
  it('exports all expected event types', () => {
    expect(WEBHOOK_EVENT_TYPES).toContain('citation.new');
    expect(WEBHOOK_EVENT_TYPES).toContain('citation.updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('alert.triggered');
    expect(WEBHOOK_EVENT_TYPES).toContain('report.generated');
    expect(WEBHOOK_EVENT_TYPES).toContain('model_run.completed');
    expect(WEBHOOK_EVENT_TYPES).toContain('brand.created');
    expect(WEBHOOK_EVENT_TYPES).toContain('brand.updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('brand.deleted');
    expect(WEBHOOK_EVENT_TYPES).toContain('prompt_set.created');
    expect(WEBHOOK_EVENT_TYPES).toContain('prompt_set.updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('prompt_set.deleted');
    expect(WEBHOOK_EVENT_TYPES).toContain('model_run.partial');
    expect(WEBHOOK_EVENT_TYPES).toContain('model_run.failed');
    expect(WEBHOOK_EVENT_TYPES).toContain('adapter.health_changed');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.recommendation_share_updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.sentiment_aggregate_updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.citation_sources_updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.opportunities_updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.position_aggregate_updated');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.trend_anomaly_detected');
    expect(WEBHOOK_EVENT_TYPES).toContain('alert.acknowledged');
    expect(WEBHOOK_EVENT_TYPES).toContain('report_schedule.delivered');
    expect(WEBHOOK_EVENT_TYPES).toContain('report_schedule.failed');
    expect(WEBHOOK_EVENT_TYPES).toContain('traffic.daily_summary');
    expect(WEBHOOK_EVENT_TYPES).toContain('gsc.sync_completed');
    expect(WEBHOOK_EVENT_TYPES).toContain('query_fanout.extracted');
    expect(WEBHOOK_EVENT_TYPES).toContain('query_fanout.simulated');
    expect(WEBHOOK_EVENT_TYPES).toContain('webhook.test');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.geo_score_computed');
    expect(WEBHOOK_EVENT_TYPES).toContain('visibility.seo_score_computed');
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(30);
  });

  it('has sample payloads for all event types', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      expect(WEBHOOK_SAMPLE_PAYLOADS[eventType]).toBeDefined();
      expect(typeof WEBHOOK_SAMPLE_PAYLOADS[eventType]).toBe('object');
    }
  });

  it('derives WebhookEventType union correctly', () => {
    // Type check: valid event type compiles
    const valid: WebhookEventType = 'citation.new';
    expect(valid).toBe('citation.new');
  });

  it('sample payloads are non-empty objects', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      const payload = WEBHOOK_SAMPLE_PAYLOADS[eventType];
      expect(Object.keys(payload).length).toBeGreaterThan(0);
    }
  });
});
