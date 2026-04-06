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

Follow [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are enforced by commitlint via a Git hook and in CI.

#### Format

```
<type>[(scope)]: <description>

[body]

[footer(s)]
```

#### Types

- `feat:` new feature (SemVer MINOR)
- `fix:` bug fix (SemVer PATCH)
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or correcting tests
- `chore:` maintenance tasks
- `perf:` performance improvement
- `ci:` CI/CD changes
- `build:` build system or dependency changes
- `style:` formatting, whitespace (not CSS)

#### Scopes

Scopes are optional but recommended when the change is contained to a single area. Use the module or library name from the source tree:

- **Domain** (`src/modules/`): `adapters`, `alerts`, `auth`, `brands`, `citations`, `model-runs`, `notifications`, `prompt-sets`, `visibility`, `webhooks`, `workspace`
- **Infrastructure** (`src/lib/`): `api`, `db`, `i18n`, `jobs`, `worker`, `config`

Omit the scope when a change spans multiple modules.

#### Subject Line

- Max 72 characters
- Imperative mood — "add feature" not "added feature"
- Test: _"If applied, this commit will \_\_\_"_
- Lowercase after the colon
- No trailing period

#### Body

Required for non-trivial changes. Explain _what_ changed and _why_, not _how_ (the diff shows how). Wrap at 72 characters. Separate from the subject with a blank line.

#### Footers

- `Fixes #123` or `Closes #123` — link to a GitHub Issue
- `BREAKING CHANGE: <description>` — breaking changes (also signal with `!` after type/scope, e.g. `feat(api)!:`)
- `Co-Authored-By:` — for AI-assisted commits

#### What NOT to reference

Do not include internal tracking IDs (PRP numbers, Linear tickets, Jira IDs, etc.) in commit messages. These are meaningless to the public and clutter the history. Use GitHub Issues as the public record of work.

#### Examples

Good:

```
feat(citations): add source attribution for Perplexity responses

Perplexity includes inline citations that differ from other engines.
Parse citation metadata from the response payload and store source
URLs alongside the visibility score.

Closes #42
```

```
fix(api): return 429 instead of 500 on rate limit exceeded
```

```
refactor(adapters): extract shared retry logic into base adapter
```

Bad:

```
fix stuff                                # no context
feat: complete PRPs 3.4-3.8             # references private tracking
Updated the parser                       # past tense, no type prefix
feat(citations): add new citation ...    # subject too long (>72 chars)
```

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
