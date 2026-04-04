# Contributing to Quaynt

Thank you for contributing to Quaynt. This guide covers the development workflow, standards, and requirements for all contributions.

## Getting Started

1. Fork the repository and clone your fork
2. Copy `.env.example` to `.env` and configure your local environment
3. Install dependencies
4. Create a feature branch from `main`

## Development Workflow

### Branch Naming

Use descriptive branch names: `feature/citation-tracking`, `fix/api-pagination`, `docs/i18n-guide`.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or correcting tests
- `chore:` maintenance tasks

### Pull Requests

- Keep PRs focused on a single concern
- Include updated documentation if behavior changes
- Ensure all tests pass
- Ensure linting passes

## Continuous Integration

All pull requests and pushes to `main` are checked by GitHub Actions. The following jobs must pass before merge:

| Job             | What it checks                                                                          |
| --------------- | --------------------------------------------------------------------------------------- |
| **Quality**     | ESLint, Prettier formatting, TypeScript type checking                                   |
| **Test**        | Vitest test suite with V8 coverage report                                               |
| **Build**       | Next.js production build and worker bundle                                              |
| **Commit lint** | PR title follows [Conventional Commits](https://www.conventionalcommits.org/) (PR only) |

The **Audit** job runs `npm audit --audit-level=high` and is advisory — it will not block merge.

Before pushing, verify locally:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run build
```

On merge to `main`, a Docker image is built, smoke-tested, and published to GHCR at `ghcr.io/xheggs/quaynt`.

## Code Standards

- Follow the linting configuration
- No file longer than 500 lines
- Each module has a single clear responsibility
- Organize by feature/domain, not by file type

## Testing Requirements

Every feature must include unit tests. Define what "done" means for your change and verify it with tests.

## Security Requirements

- NEVER commit secrets, credentials, API keys, or tokens
- NEVER commit `.env` files (only `.env.example` is allowed)
- Always validate and sanitize user input
- See `SECURITY.md` for the full security policy

PRs containing credentials will be rejected.

## i18n Requirements

- NEVER hardcode user-facing strings
- Use localization keys for all text visible to users
- Use interpolation placeholders, not string concatenation
- Use locale-aware formatting for dates, numbers, and currencies

PRs with hardcoded user-facing strings will be rejected.
