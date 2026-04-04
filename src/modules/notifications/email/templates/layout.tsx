import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from '@react-email/components';
import type { ReactNode } from 'react';

export interface EmailLayoutProps {
  locale: string;
  preview: string;
  children: ReactNode;
  footer: {
    whyReceived: string;
    managePreferences: string;
    unsubscribe: string;
    privacy: string;
    preferencesUrl: string;
    unsubscribeUrl: string;
    privacyUrl: string;
  };
}

const COLORS = {
  bg: '#f4f4f5',
  bgDark: '#18181b',
  surface: '#ffffff',
  surfaceDark: '#27272a',
  text: '#18181b',
  textDark: '#fafafa',
  muted: '#71717a',
  mutedDark: '#a1a1aa',
  border: '#e4e4e7',
  borderDark: '#3f3f46',
  brand: '#6d28d9',
};

export function EmailLayout({ locale, preview, children, footer }: EmailLayoutProps) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>Quaynt</Text>
          </Section>

          {children}

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={footerText}>{footer.whyReceived}</Text>
            <Text style={footerLinks}>
              <Link href={footer.preferencesUrl} style={footerLink}>
                {footer.managePreferences}
              </Link>
              {' | '}
              <Link href={footer.unsubscribeUrl} style={footerLink}>
                {footer.unsubscribe}
              </Link>
              {' | '}
              <Link href={footer.privacyUrl} style={footerLink}>
                {footer.privacy}
              </Link>
            </Text>
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

const divider = {
  borderColor: COLORS.border,
  margin: '24px 0',
};

const footerSection = {
  padding: '0 0 24px',
};

const footerText = {
  fontSize: '13px',
  lineHeight: '20px',
  color: COLORS.muted,
  margin: '0 0 8px',
};

const footerLinks = {
  fontSize: '13px',
  lineHeight: '20px',
  color: COLORS.muted,
  margin: '0' as const,
};

const footerLink = {
  color: COLORS.muted,
  textDecoration: 'underline' as const,
};
