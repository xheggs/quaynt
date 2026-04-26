import type React from 'react';
import { render } from '@react-email/render';
import { AlertTriggeredEmail } from './email/templates/alert-triggered';
import { AlertDigestEmail } from './email/templates/alert-digest';
import type { DigestBrandGroup } from './email/templates/alert-digest';
import type { DigestFrequency, AlertEventRow, AlertRuleRow } from './notification.types';

// --- Translation loading ---

export async function loadEmailTranslations(locale: string): Promise<Record<string, unknown>> {
  try {
    const mod = await import(`../../../locales/${locale}/emails.json`);
    return mod.default as Record<string, unknown>;
  } catch {
    const mod = await import('../../../locales/en/emails.json');
    return mod.default as Record<string, unknown>;
  }
}

export async function loadAlertTranslations(locale: string): Promise<Record<string, unknown>> {
  try {
    const mod = await import(`../../../locales/${locale}/alerts.json`);
    const json = mod.default as Record<string, unknown>;
    return (json.alerts as Record<string, unknown>) ?? json;
  } catch {
    const mod = await import('../../../locales/en/alerts.json');
    const json = mod.default as Record<string, unknown>;
    return (json.alerts as Record<string, unknown>) ?? json;
  }
}

export function t(
  translations: Record<string, unknown>,
  key: string,
  params?: Record<string, string | number>
): string {
  const parts = key.split('.');
  let value: unknown = translations;
  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  if (typeof value !== 'string') return key;

  // Simple ICU MessageFormat interpolation (handles {key} and basic {count, plural, one {#...} other {#...}})
  let result = value;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    // Handle simple plural: {count, plural, one {# text} other {# text}}
    result = result.replace(
      /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
      (_match, paramName, oneForm, otherForm) => {
        const count = params[paramName];
        if (count === undefined) return _match;
        const form = Number(count) === 1 ? oneForm : otherForm;
        return form.replace(/#/g, String(count));
      }
    );
  }
  return result;
}

// --- Metric/condition label helpers ---

export const METRIC_KEYS: Record<string, string> = {
  recommendation_share: 'metric.recommendationShare',
  citation_count: 'metric.citationCount',
  sentiment_score: 'metric.sentimentScore',
  position_average: 'metric.positionAverage',
};

export const CONDITION_KEYS: Record<string, string> = {
  drops_below: 'condition.dropsBelow',
  exceeds: 'condition.exceeds',
  changes_by_percent: 'condition.changesByPercent',
  changes_by_absolute: 'condition.changesByAbsolute',
};

// --- Formatting helpers ---

export function formatNumber(value: string | number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(value));
}

function formatTimestamp(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

// --- Email rendering ---

export async function renderAlertEmail(
  alertEvent: AlertEventRow,
  rule: AlertRuleRow,
  locale: string,
  baseUrl: string,
  unsubscribeUrl: string
) {
  const emailT = await loadEmailTranslations(locale);
  const alertT = await loadAlertTranslations(locale);

  const scope = alertEvent.scopeSnapshot;
  const brandName = scope.brandName ?? scope.brandId;
  const metricLabel = t(alertT, METRIC_KEYS[rule.metric] ?? rule.metric);
  const conditionLabel = t(alertT, CONDITION_KEYS[alertEvent.condition] ?? alertEvent.condition);
  const severityLabel = t(emailT, `severity.${alertEvent.severity}`);
  const currentValue = formatNumber(alertEvent.metricValue, locale);
  const previousValue = alertEvent.previousValue
    ? formatNumber(alertEvent.previousValue, locale)
    : '—';
  const threshold = formatNumber(alertEvent.threshold, locale);

  const delta = alertEvent.previousValue
    ? formatNumber(Number(alertEvent.metricValue) - Number(alertEvent.previousValue), locale)
    : '—';
  const changeRate =
    alertEvent.previousValue && Number(alertEvent.previousValue) !== 0
      ? `${(((Number(alertEvent.metricValue) - Number(alertEvent.previousValue)) / Number(alertEvent.previousValue)) * 100).toFixed(1)}%`
      : '—';
  const preferencesUrl = `${baseUrl}/settings/notifications`;
  const privacyUrl = `${baseUrl}/privacy`;
  const viewUrl = `${baseUrl}/alerts`;

  const subject = t(emailT, 'alert.subject', {
    severity: severityLabel,
    brandName,
    metricLabel,
    conditionLabel,
    currentValue,
  });

  const brandT = (emailT.brand ?? {}) as Record<string, unknown>;

  const templateProps = {
    locale,
    appUrl: baseUrl,
    tagline: t(brandT, 'tagline'),
    severity: alertEvent.severity,
    translations: {
      preview: t(emailT, 'alert.preview', { brandName, metricLabel, currentValue, previousValue }),
      greeting: t(emailT, 'alert.greeting', { brandName }),
      metricSummary: t(emailT, 'alert.metricSummary', { metricLabel, conditionLabel, threshold }),
      currentValue: t(emailT, 'alert.currentValue', { currentValue }),
      previousValue: t(emailT, 'alert.previousValue', { previousValue }),
      change: t(emailT, 'alert.change', { delta, changeRate }),
      scope: t(emailT, 'alert.scope', {
        platformName: scope.platformName ?? '—',
        locale: scope.locale ?? '—',
      }),
      ruleName: t(emailT, 'alert.ruleName', { ruleName: rule.name }),
      viewButton: t(emailT, 'alert.viewButton'),
      triggeredAt: t(emailT, 'alert.triggeredAt', {
        timestamp: formatTimestamp(alertEvent.triggeredAt, locale),
      }),
      severityLabel,
    },
    viewUrl,
    unsubscribeUrl,
    preferencesUrl,
    privacyUrl,
    footer: {
      whyReceived: t(emailT, 'footer.whyReceived', { workspaceName: alertEvent.workspaceId }),
      managePreferences: t(emailT, 'footer.managePreferences'),
      unsubscribe: t(emailT, 'footer.unsubscribe'),
      privacy: t(emailT, 'footer.privacy'),
    },
  };

  // render() accepts ReactElement; calling the component function produces one
  const element = AlertTriggeredEmail(templateProps) as unknown as React.ReactElement;
  const html = await render(element);

  const { toPlainText } = await import('@react-email/render');
  const text = toPlainText(html);

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export async function renderDigestEmail(
  alertEvents: AlertEventRow[],
  rules: Map<string, AlertRuleRow>,
  period: DigestFrequency,
  locale: string,
  baseUrl: string,
  unsubscribeUrl: string
) {
  const emailT = await loadEmailTranslations(locale);
  const alertT = await loadAlertTranslations(locale);
  const periodLabel = t(emailT, `period.${period}`);

  // Group events by brand, sort by severity within each group
  const brandMap = new Map<string, DigestBrandGroup>();
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

  for (const event of alertEvents) {
    const scope = event.scopeSnapshot;
    const brandName = scope.brandName ?? scope.brandId;
    const rule = rules.get(event.alertRuleId);

    if (!brandMap.has(brandName)) {
      brandMap.set(brandName, {
        brandName,
        brandSectionLabel: t(emailT, 'digest.brandSection', { brandName, count: 0 }),
        alerts: [],
      });
    }

    const group = brandMap.get(brandName)!;
    group.alerts.push({
      severity: event.severity,
      severityLabel: t(emailT, `severity.${event.severity}`),
      metricLabel: t(alertT, METRIC_KEYS[rule?.metric ?? ''] ?? rule?.metric ?? ''),
      conditionLabel: t(alertT, CONDITION_KEYS[event.condition] ?? event.condition),
      currentValue: formatNumber(event.metricValue, locale),
      previousValue: event.previousValue ? formatNumber(event.previousValue, locale) : '—',
    });
  }

  // Sort alerts by severity and update brand section labels with count
  const brands: DigestBrandGroup[] = [];
  for (const group of brandMap.values()) {
    group.alerts.sort(
      (a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
    );
    group.brandSectionLabel = t(emailT, 'digest.brandSection', {
      brandName: group.brandName,
      count: group.alerts.length,
    });
    brands.push(group);
  }
  const preferencesUrl = `${baseUrl}/settings/notifications`;
  const privacyUrl = `${baseUrl}/privacy`;
  const viewUrl = `${baseUrl}/alerts`;

  const subject = t(emailT, 'digest.subject', { count: alertEvents.length, period: periodLabel });

  const brandT = (emailT.brand ?? {}) as Record<string, unknown>;

  const props = {
    locale,
    appUrl: baseUrl,
    tagline: t(brandT, 'tagline'),
    translations: {
      preview: t(emailT, 'digest.preview', { count: alertEvents.length }),
      heading: t(emailT, 'digest.heading', { period: periodLabel }),
      alertCount: t(emailT, 'digest.alertCount', { count: alertEvents.length }),
      viewAllButton: t(emailT, 'digest.viewAllButton'),
      noAlerts: t(emailT, 'digest.noAlerts'),
    },
    brands,
    viewUrl,
    unsubscribeUrl,
    preferencesUrl,
    privacyUrl,
    footer: {
      whyReceived: t(emailT, 'footer.whyReceived', {
        workspaceName: alertEvents[0]?.workspaceId ?? '',
      }),
      managePreferences: t(emailT, 'footer.managePreferences'),
      unsubscribe: t(emailT, 'footer.unsubscribe'),
      privacy: t(emailT, 'footer.privacy'),
    },
  };

  const digestElement = AlertDigestEmail(props) as unknown as React.ReactElement;
  const html = await render(digestElement);
  const { toPlainText } = await import('@react-email/render');
  const text = toPlainText(html);

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
