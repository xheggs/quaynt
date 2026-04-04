# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Quaynt, please report it responsibly. Do NOT open a public issue.

Email: _security@quaynt.com (to be configured)\_

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Secrets Management

- All secrets are stored in environment variables loaded from `.env` files
- `.env` files are gitignored and must never be committed
- `.env.example` contains placeholder values only
- The application must never log, display, or transmit secrets
- API keys and tokens must be loaded at runtime, never hardcoded

## Authentication and Authorization

_To be defined as the auth system is implemented._

- Session management approach
- Role-based access control model
- API authentication method (API keys, OAuth, JWT)

## Input Validation

- All user input must be validated and sanitized at the API boundary
- Never trust client-side validation alone
- Use parameterized queries for all database operations
- Sanitize output to prevent XSS

## Dependency Security

- Audit dependencies regularly with automated scanning
- Review new dependency additions for security implications
- Pin dependency versions to prevent supply chain attacks
- Prefer well-maintained, widely-used packages

## Data Protection

- Encrypt sensitive data at rest and in transit
- Use HTTPS for all communications
- Minimize data collection to what is necessary
- Follow GDPR and applicable privacy regulations

## Contributor Guidelines

- Never include secrets in commits, tests, documentation, or comments
- Never use real credentials in test fixtures — use obvious fakes
- Security-sensitive changes require explicit review
- Report suspicious dependencies or code patterns
