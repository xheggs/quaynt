import { Section, Text, Button } from '@react-email/components';
import { EmailLayout } from './layout';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
};

export interface AlertTriggeredEmailProps {
  locale: string;
  severity: string;
  translations: {
    preview: string;
    greeting: string;
    metricSummary: string;
    currentValue: string;
    previousValue: string;
    change: string;
    scope: string;
    ruleName: string;
    viewButton: string;
    triggeredAt: string;
    severityLabel: string;
  };
  viewUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  privacyUrl: string;
  footer: {
    whyReceived: string;
    managePreferences: string;
    unsubscribe: string;
    privacy: string;
  };
}

export function AlertTriggeredEmail({
  locale,
  severity,
  translations: t,
  viewUrl,
  unsubscribeUrl,
  preferencesUrl,
  privacyUrl,
  footer,
}: AlertTriggeredEmailProps) {
  const severityColor = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info;

  return (
    <EmailLayout
      locale={locale}
      preview={t.preview}
      footer={{
        ...footer,
        preferencesUrl,
        unsubscribeUrl,
        privacyUrl,
      }}
    >
      <Section style={card}>
        <Section
          style={{
            ...severityBanner,
            backgroundColor: severityColor,
          }}
        >
          <Text style={severityText}>{t.severityLabel}</Text>
        </Section>

        <Section style={cardBody}>
          <Text style={greeting}>{t.greeting}</Text>
          <Text style={metricSummary}>{t.metricSummary}</Text>

          <Section style={detailsBlock}>
            <Text style={detailLine}>{t.currentValue}</Text>
            <Text style={detailLine}>{t.previousValue}</Text>
            <Text style={detailLine}>{t.change}</Text>
            <Text style={detailLine}>{t.scope}</Text>
            <Text style={detailLine}>{t.ruleName}</Text>
          </Section>

          <Text style={timestamp}>{t.triggeredAt}</Text>

          <Section style={ctaSection}>
            <Button href={viewUrl} style={ctaButton}>
              {t.viewButton}
            </Button>
          </Section>
        </Section>
      </Section>
    </EmailLayout>
  );
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden' as const,
  border: '1px solid #e4e4e7',
};

const severityBanner = {
  padding: '12px 24px',
};

const severityText = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#ffffff',
  margin: '0' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const cardBody = {
  padding: '24px',
};

const greeting = {
  fontSize: '20px',
  fontWeight: '600' as const,
  color: '#18181b',
  margin: '0 0 8px',
};

const metricSummary = {
  fontSize: '16px',
  color: '#3f3f46',
  margin: '0 0 20px',
};

const detailsBlock = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
};

const detailLine = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '0' as const,
};

const timestamp = {
  fontSize: '13px',
  color: '#71717a',
  margin: '0 0 20px',
};

const ctaSection = {
  textAlign: 'center' as const,
};

const ctaButton = {
  backgroundColor: '#6d28d9',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  padding: '14px 32px',
  borderRadius: '6px',
  textDecoration: 'none' as const,
  display: 'inline-block' as const,
};
