import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type {
  AlertRule,
  AlertRuleCreate,
  AlertRuleUpdate,
  AlertEvent,
  AlertSnoozeInput,
  AlertSummary,
  NotificationPreferencesResponse,
  EmailPreferenceUpdate,
  WebhookPreferenceUpdate,
} from './alerts.types';

// --- Alert Rules ---

export interface FetchAlertRulesParams extends QueryFilters {
  metric?: string;
  enabled?: string;
}

export function fetchAlertRules(
  params?: FetchAlertRulesParams
): Promise<PaginatedResponse<AlertRule>> {
  return apiFetchPaginated<AlertRule>('/alerts/rules', { ...params });
}

export function fetchAlertRule(id: string): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/alerts/rules/${id}`);
}

export function createAlertRule(input: AlertRuleCreate): Promise<AlertRule> {
  return apiFetch<AlertRule>('/alerts/rules', { method: 'POST', body: input });
}

export function updateAlertRule(id: string, input: AlertRuleUpdate): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/alerts/rules/${id}`, { method: 'PATCH', body: input });
}

export function deleteAlertRule(id: string): Promise<void> {
  return apiFetch<void>(`/alerts/rules/${id}`, { method: 'DELETE' });
}

// --- Alert Events ---

export interface FetchAlertEventsParams extends QueryFilters {
  alertRuleId?: string;
  severity?: string;
  status?: string;
}

export function fetchAlertEvents(
  params?: FetchAlertEventsParams
): Promise<PaginatedResponse<AlertEvent>> {
  return apiFetchPaginated<AlertEvent>('/alerts/events', { ...params });
}

export function acknowledgeEvent(id: string): Promise<AlertEvent> {
  return apiFetch<AlertEvent>(`/alerts/events/${id}/acknowledge`, {
    method: 'PATCH',
  });
}

export function snoozeEvent(id: string, input: AlertSnoozeInput): Promise<AlertEvent> {
  return apiFetch<AlertEvent>(`/alerts/events/${id}/snooze`, {
    method: 'PATCH',
    body: input,
  });
}

// --- Alert Summary ---

export function fetchAlertSummary(params?: { from?: string; to?: string }): Promise<AlertSummary> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  const queryString = searchParams.toString();
  const path = queryString ? `/alerts/summary?${queryString}` : '/alerts/summary';
  return apiFetch<AlertSummary>(path);
}

// --- Notification Preferences ---

export function fetchNotificationPreferences(
  channel?: string
): Promise<NotificationPreferencesResponse> {
  const searchParams = new URLSearchParams();
  if (channel) searchParams.set('channel', channel);
  const queryString = searchParams.toString();
  const path = queryString
    ? `/notifications/preferences?${queryString}`
    : '/notifications/preferences';
  return apiFetch<NotificationPreferencesResponse>(path);
}

export function updateNotificationPreferences(input: {
  email?: EmailPreferenceUpdate;
  webhook?: WebhookPreferenceUpdate;
}): Promise<NotificationPreferencesResponse> {
  return apiFetch<NotificationPreferencesResponse>('/notifications/preferences', {
    method: 'PATCH',
    body: input,
  });
}
