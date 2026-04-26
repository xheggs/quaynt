import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Img,
  Hr,
  Preview,
} from '@react-email/components';
import type { ReactNode } from 'react';

export interface EmailLayoutProps {
  locale: string;
  preview: string;
  appUrl: string;
  tagline: string;
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
  brand: '#7C5CBA',
  text: '#111111',
  muted: '#666666',
  border: '#E5E5E5',
  bg: '#FFFFFF',
};

const FONT_STACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Static CSS string injected into <style> for prefers-color-scheme dark mode.
// Hardcoded constant — no user input, no XSS surface.
const DARK_MODE_CSS = `
@media (prefers-color-scheme: dark) {
  body,
  .email-body,
  .email-body > table > tbody > tr > td {
    background-color: #0F0F11 !important;
  }
  .text-foreground { color: #EAEAE8 !important; }
  .text-muted { color: #9B9B98 !important; }
  .divider { border-color: rgba(255, 255, 255, 0.10) !important; }
  .privacy-link, .footer-link { color: #9B9B98 !important; }
  .logo-light { display: none !important; }
  .logo-dark { display: block !important; }
}
`;

export function EmailLayout({
  locale,
  preview,
  appUrl,
  tagline,
  children,
  footer,
}: EmailLayoutProps) {
  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- emailed HTML, not a Next.js page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{DARK_MODE_CSS}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="email-body" style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${appUrl}/brand/quaynt-logo-dark.png`}
              alt="Quaynt"
              width="112"
              className="logo-light"
              style={logoImg}
            />
            <Img
              src={`${appUrl}/brand/quaynt-logo-light.png`}
              alt="Quaynt"
              width="112"
              className="logo-dark"
              style={logoImgHidden}
            />
          </Section>

          {children}

          <Hr className="divider" style={divider} />

          <Section style={footerSection}>
            <Text className="text-muted" style={footerText}>
              {footer.whyReceived}
            </Text>
            <Text className="text-muted" style={footerLinks}>
              <Link className="footer-link" href={footer.preferencesUrl} style={footerLink}>
                {footer.managePreferences}
              </Link>
              {' · '}
              <Link className="footer-link" href={footer.unsubscribeUrl} style={footerLink}>
                {footer.unsubscribe}
              </Link>
              {' · '}
              <Link className="footer-link" href={footer.privacyUrl} style={footerLink}>
                {footer.privacy}
              </Link>
            </Text>
            <Text className="text-muted" style={taglineText}>
              {tagline}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: COLORS.bg,
  fontFamily: FONT_STACK,
  margin: '0' as const,
  padding: '0' as const,
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 24px 48px',
};

const header = {
  paddingBottom: '32px',
};

const logoImg = {
  display: 'block' as const,
  border: '0' as const,
  outline: 'none' as const,
  textDecoration: 'none' as const,
};

// Default-hidden so Gmail (which strips <style>) keeps it invisible.
// The dark-mode media query overrides this with !important in clients
// that honor it (Apple Mail, iOS Mail, recent Outlook).
const logoImgHidden = {
  ...logoImg,
  display: 'none' as const,
};

const divider = {
  borderColor: COLORS.border,
  borderTopWidth: '1px',
  margin: '32px 0 20px',
};

const footerSection = {
  padding: '0 0 8px',
};

const footerText = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: COLORS.muted,
  letterSpacing: '0.01em',
  margin: '0 0 8px',
};

const footerLinks = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: COLORS.muted,
  letterSpacing: '0.02em',
  margin: '0 0 12px',
};

const footerLink = {
  color: COLORS.muted,
  textDecoration: 'underline' as const,
};

const taglineText = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: COLORS.muted,
  letterSpacing: '0.02em',
  margin: '0',
};
