# Modules

Each module owns its domain logic, schema, and types.

## Conventions

- One directory per domain (e.g., `auth/`, `brands/`, `visibility/`)
- Each module may contain:
  - `*.schema.ts` — Drizzle table definitions (re-exported via `src/lib/db/schema.ts`)
  - `*.service.ts` — Business logic functions
  - `*.types.ts` — TypeScript types and Zod schemas
  - `*.test.ts` — Unit tests
- Modules never import directly from other modules. Use shared interfaces in `src/lib/`.
- Keep route handlers in `src/app/` thin — delegate to module services.
