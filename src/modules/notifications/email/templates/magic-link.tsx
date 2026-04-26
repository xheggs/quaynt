import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Link,
  Img,
  Hr,
  Preview,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  url: string;
  appUrl: string;
  privacyUrl: string;
  locale: string;
  translations: {
    preview: string;
    eyebrow: string;
    heading: string;
    body: string;
    buttonText: string;
    fallbackIntro: string;
    sentToNotice: string;
    tagline: string;
    privacy: string;
  };
}

const COLORS = {
  brand: '#7C5CBA',
  text: '#111111',
  muted: '#666666',
  border: '#E5E5E5',
  surface: '#F5F5F5',
  bg: '#FFFFFF',
};

const FONT_STACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

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
  .link-fallback {
    background-color: #18181B !important;
    border-color: rgba(255, 255, 255, 0.10) !important;
    color: #9B9B98 !important;
  }
  .privacy-link { color: #9B9B98 !important; }
  .logo-light { display: none !important; }
  .logo-dark { display: block !important; }
}
`;

export function MagicLinkEmail({
  url,
  appUrl,
  privacyUrl,
  locale,
  translations: t,
}: MagicLinkEmailProps) {
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
      <Preview>{t.preview}</Preview>
      <Body className="email-body" style={body}>
        <Container style={container}>
          <Section style={headerSection}>
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

          <Text className="text-muted" style={eyebrow}>
            {t.eyebrow}
          </Text>
          <Text className="text-foreground" style={heading}>
            {t.heading}
          </Text>
          <Text className="text-foreground" style={bodyText}>
            {t.body}
          </Text>

          <Section style={ctaSection}>
            <Button href={url} style={ctaButton}>
              {t.buttonText}
            </Button>
          </Section>

          <Text className="text-muted" style={fallbackIntro}>
            {t.fallbackIntro}
          </Text>
          <Text className="link-fallback text-muted" style={linkFallback}>
            {url}
          </Text>

          <Hr className="divider" style={divider} />

          <Text className="text-muted" style={sentTo}>
            {t.sentToNotice}
          </Text>

          <Text className="text-muted" style={taglineText}>
            {t.tagline}
            {' · '}
            <Link className="privacy-link" href={privacyUrl} style={privacyLink}>
              {t.privacy}
            </Link>
          </Text>
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
  padding: '48px 24px 56px',
};

const headerSection = {
  paddingBottom: '40px',
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

const eyebrow = {
  fontSize: '11px',
  fontWeight: 600,
  color: COLORS.muted,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  margin: '0 0 12px',
};

const heading = {
  fontSize: '28px',
  lineHeight: '1.2',
  fontWeight: 700,
  color: COLORS.text,
  letterSpacing: '-0.025em',
  margin: '0 0 12px',
};

const bodyText = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: COLORS.text,
  letterSpacing: '-0.005em',
  margin: '0',
};

const ctaSection = {
  padding: '32px 0 36px',
};

const ctaButton = {
  backgroundColor: COLORS.brand,
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '-0.005em',
  padding: '12px 22px',
  borderRadius: '6px',
  textDecoration: 'none' as const,
  display: 'inline-block' as const,
};

const fallbackIntro = {
  fontSize: '12px',
  color: COLORS.muted,
  letterSpacing: '0.02em',
  margin: '0 0 8px',
};

const linkFallback = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: COLORS.muted,
  fontFamily: MONO_STACK,
  wordBreak: 'break-all' as const,
  margin: '0 0 32px',
  padding: '10px 12px',
  backgroundColor: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '6px',
};

const divider = {
  borderColor: COLORS.border,
  borderTopWidth: '1px',
  margin: '8px 0 24px',
};

const sentTo = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: COLORS.muted,
  letterSpacing: '0.01em',
  margin: '0 0 16px',
};

const taglineText = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: COLORS.muted,
  letterSpacing: '0.02em',
  margin: '0',
};

const privacyLink = {
  color: COLORS.muted,
  textDecoration: 'underline' as const,
};
