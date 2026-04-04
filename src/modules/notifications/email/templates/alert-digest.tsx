import { Section, Text, Button, Hr } from '@react-email/components';
import { EmailLayout } from './layout';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
};

export interface DigestAlertItem {
  severity: string;
  severityLabel: string;
  metricLabel: string;
  conditionLabel: string;
  currentValue: string;
  previousValue: string;
}

export interface DigestBrandGroup {
  brandName: string;
  brandSectionLabel: string;
  alerts: DigestAlertItem[];
}

export interface AlertDigestEmailProps {
  locale: string;
  translations: {
    preview: string;
    heading: string;
    alertCount: string;
    viewAllButton: string;
    noAlerts: string;
  };
  brands: DigestBrandGroup[];
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

export function AlertDigestEmail({
  locale,
  translations: t,
  brands,
  viewUrl,
  unsubscribeUrl,
  preferencesUrl,
  privacyUrl,
  footer,
}: AlertDigestEmailProps) {
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
        <Section style={cardHeader}>
          <Text style={heading}>{t.heading}</Text>
          <Text style={alertCount}>{t.alertCount}</Text>
        </Section>

        <Section style={cardBody}>
          {brands.length === 0 ? (
            <Text style={noAlerts}>{t.noAlerts}</Text>
          ) : (
            brands.map((brand, i) => (
              <Section key={brand.brandName}>
                {i > 0 && <Hr style={brandDivider} />}
                <Text style={brandSection}>{brand.brandSectionLabel}</Text>
                {brand.alerts.map((alert, j) => (
                  <Section key={j} style={alertRow}>
                    <Text style={alertLine}>
                      <span
                        style={{
                          ...severityDot,
                          backgroundColor: SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.info,
                        }}
                      />{' '}
                      <span style={alertSeverity}>{alert.severityLabel}</span>
                      {' — '}
                      {alert.metricLabel} {alert.conditionLabel}
                    </Text>
                    <Text style={alertValues}>
                      {alert.currentValue} (was {alert.previousValue})
                    </Text>
                  </Section>
                ))}
              </Section>
            ))
          )}

          <Section style={ctaSection}>
            <Button href={viewUrl} style={ctaButton}>
              {t.viewAllButton}
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

const cardHeader = {
  backgroundColor: '#fafafa',
  padding: '20px 24px',
  borderBottom: '1px solid #e4e4e7',
};

const heading = {
  fontSize: '20px',
  fontWeight: '600' as const,
  color: '#18181b',
  margin: '0 0 4px',
};

const alertCount = {
  fontSize: '14px',
  color: '#71717a',
  margin: '0' as const,
};

const cardBody = {
  padding: '24px',
};

const noAlerts = {
  fontSize: '14px',
  color: '#71717a',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const brandSection = {
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#18181b',
  margin: '0 0 12px',
};

const brandDivider = {
  borderColor: '#e4e4e7',
  margin: '20px 0',
};

const alertRow = {
  marginBottom: '8px',
};

const alertLine = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '0' as const,
};

const severityDot = {
  display: 'inline-block' as const,
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  verticalAlign: 'middle' as const,
};

const alertSeverity = {
  fontWeight: '500' as const,
};

const alertValues = {
  fontSize: '13px',
  color: '#71717a',
  margin: '0 0 4px',
  paddingLeft: '16px',
};

const ctaSection = {
  textAlign: 'center' as const,
  paddingTop: '16px',
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
