# Quaynt — AI Operating Contract

You are working on **Quaynt**, an open-source AI visibility platform that tracks how brands appear across AI-powered search and recommendation engines (ChatGPT, Perplexity, Gemini, etc.).

## Core Principles

1. **Lightweight and fast.** Every dependency must justify its existence. Prefer small, focused libraries over large frameworks. Measure impact before adding anything.
2. **Integration-ready from day one.** Every feature must be accessible via API. No feature should exist only as a UI interaction.
3. **Internationalization by default.** NEVER hardcode user-facing strings. All text must go through localization keys.
4. **Open-source hygiene.** NEVER commit secrets, credentials, API keys, or personal configuration.
5. **Documentation is a deliverable.** Every public function, module, and API endpoint must have clear documentation. Undocumented features are incomplete features.

## Before Starting Any Task

1. Read the relevant issue or PR description.
2. Check existing patterns in the codebase.
3. Plan the work before writing code.
4. Validate against tests and linting before considering the task complete.

## File and Module Rules

- No file longer than 500 lines. Split into focused modules at that limit.
- Each module has a single clear responsibility.
- Name files descriptively: `citation-explorer.js` not `ce.js`.
- Organize by feature/domain, not by file type.

## Code Style

- Fail fast with typed errors and meaningful messages.
- Every new feature includes unit tests.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages — see `CONTRIBUTING.md` for the full guideline.
- NEVER hardcode user-facing strings — use localization keys.
- NEVER concatenate strings to build messages — use interpolation placeholders.
- Use locale-aware formatting for dates, numbers, and currencies.

## Security

- NEVER commit secrets, credentials, API keys, or `.env` files.
- Only `.env.example` with placeholder values is allowed in version control.
- Always validate and sanitize user input at the API boundary.
- Use parameterized queries for all database operations.
- Sanitize output to prevent XSS.
