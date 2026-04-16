import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Preview,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  url: string;
  locale: string;
  translations: {
    preview: string;
    heading: string;
    body: string;
    buttonText: string;
    expiry: string;
    ignoreNotice: string;
  };
}

const COLORS = {
  bg: '#f4f4f5',
  text: '#18181b',
  muted: '#71717a',
  brand: '#6d28d9',
};

export function MagicLinkEmail({ url, locale, translations: t }: MagicLinkEmailProps) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>Quaynt</Text>
          </Section>

          <Section style={card}>
            <Text style={heading}>{t.heading}</Text>
            <Text style={bodyText}>{t.body}</Text>

            <Section style={ctaSection}>
              <Button href={url} style={ctaButton}>
                {t.buttonText}
              </Button>
            </Section>

            <Text style={expiryText}>{t.expiry}</Text>
            <Text style={ignoreText}>{t.ignoreNotice}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: COLORS.bg,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  margin: '0' as const,
  padding: '0' as const,
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px 16px',
};

const header = {
  padding: '24px 0 16px',
};

const logoText = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: COLORS.brand,
  margin: '0' as const,
};

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '32px 24px',
  border: '1px solid #e4e4e7',
};

const heading = {
  fontSize: '20px',
  fontWeight: '600' as const,
  color: COLORS.text,
  margin: '0 0 12px',
};

const bodyText = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#3f3f46',
  margin: '0 0 24px',
};

const ctaSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const ctaButton = {
  backgroundColor: COLORS.brand,
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  padding: '14px 32px',
  borderRadius: '6px',
  textDecoration: 'none' as const,
  display: 'inline-block' as const,
};

const expiryText = {
  fontSize: '13px',
  color: COLORS.muted,
  margin: '0 0 8px',
};

const ignoreText = {
  fontSize: '13px',
  color: COLORS.muted,
  margin: '0' as const,
};
