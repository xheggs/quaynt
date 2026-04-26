import { Section, Text, Button, Hr } from '@react-email/components';
import { EmailLayout } from '@/modules/notifications/email/templates/layout';

export interface ScheduledReportEmailProps {
  locale: string;
  appUrl: string;
  tagline: string;
  translations: {
    preview: string;
    heading: string;
    periodLabel: string;
    periodValue: string;
    formatLabel: string;
    formatValue: string;
    highlightsHeading: string;
    pdfAttachedNote: string;
    downloadButton: string;
    viewInQuaynt: string;
  };
  isPdfAttached: boolean;
  downloadUrl: string | null;
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

export function ScheduledReportEmail({
  locale,
  appUrl,
  tagline,
  translations: t,
  isPdfAttached,
  downloadUrl,
  viewUrl,
  unsubscribeUrl,
  preferencesUrl,
  privacyUrl,
  footer,
}: ScheduledReportEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t.preview}
      appUrl={appUrl}
      tagline={tagline}
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
        </Section>

        <Section style={cardBody}>
          <Section style={metaRow}>
            <Text style={metaLabel}>{t.periodLabel}</Text>
            <Text style={metaValue}>{t.periodValue}</Text>
          </Section>

          <Section style={metaRow}>
            <Text style={metaLabel}>{t.formatLabel}</Text>
            <Text style={metaValue}>{t.formatValue}</Text>
          </Section>

          <Hr style={divider} />

          {isPdfAttached ? (
            <Text style={attachedNote}>{t.pdfAttachedNote}</Text>
          ) : downloadUrl ? (
            <Section style={ctaSection}>
              <Button href={downloadUrl} style={ctaButton}>
                {t.downloadButton}
              </Button>
            </Section>
          ) : null}

          <Section style={ctaSection}>
            <Button href={viewUrl} style={secondaryButton}>
              {t.viewInQuaynt}
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
  margin: '0' as const,
};

const cardBody = {
  padding: '24px',
};

const metaRow = {
  marginBottom: '8px',
};

const metaLabel = {
  fontSize: '13px',
  color: '#71717a',
  margin: '0 0 2px',
};

const metaValue = {
  fontSize: '15px',
  fontWeight: '500' as const,
  color: '#18181b',
  margin: '0' as const,
};

const divider = {
  borderColor: '#e4e4e7',
  margin: '16px 0',
};

const attachedNote = {
  fontSize: '14px',
  color: '#3f3f46',
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '0 0 16px',
};

const ctaSection = {
  textAlign: 'center' as const,
  paddingTop: '8px',
};

const ctaButton = {
  backgroundColor: '#7C5CBA',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  padding: '14px 32px',
  borderRadius: '6px',
  textDecoration: 'none' as const,
  display: 'inline-block' as const,
};

const secondaryButton = {
  backgroundColor: 'transparent',
  color: '#7C5CBA',
  fontSize: '14px',
  fontWeight: '500' as const,
  padding: '10px 24px',
  borderRadius: '6px',
  border: '1px solid #7C5CBA',
  textDecoration: 'none' as const,
  display: 'inline-block' as const,
};
