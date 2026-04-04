# Quaynt

Open-source AI visibility platform. Track how your brand appears across AI-powered search and recommendation engines.

## What is Quaynt?

Quaynt monitors brand citations and recommendation share across generative AI platforms — ChatGPT, Perplexity, Gemini, and others. It helps marketing teams, GEO professionals, and agencies understand and improve their AI visibility.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 LTS or later
- [PostgreSQL](https://www.postgresql.org/) 18 or later

## Getting Started

```bash
# Clone the repository
git clone https://github.com/xheggs/quaynt.git
cd quaynt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and auth secret

# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Development with Docker

### Hybrid Development (Recommended)

PostgreSQL runs in Docker; the app runs on the host for fast Turbopack hot reload.

```bash
docker compose up -d    # Start PostgreSQL
npm run dev             # Start the app
npm run worker          # Start the background worker (separate terminal)
```

### Full-Docker Development

All services run in Docker containers. No Node.js required on the host.

```bash
docker compose --profile dev up
```

This starts PostgreSQL, the web server, and the background worker with hot reload via bind mounts. If you change `package.json` dependencies:

```bash
docker compose --profile dev up --build
```

### Stopping

```bash
docker compose down       # Stop containers, preserve data
docker compose down -v    # Stop containers, delete all data
```

## Production

Build and run the production stack:

```bash
cp .env.example .env
# Edit .env with production credentials

docker compose -f compose.prod.yaml up -d
```

See `docs/deployment.md` for full production deployment guidance.

## Resetting

To reset the Docker environment (stops containers, deletes data, rebuilds):

```bash
bash scripts/docker-reset.sh
```

## Available Scripts

| Script                 | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start development server (Turbopack) |
| `npm run build`        | Production build (standalone output) |
| `npm start`            | Start production server              |
| `npm run worker`       | Start background job worker          |
| `npm test`             | Run tests in watch mode              |
| `npm run test:run`     | Run tests once                       |
| `npm run lint`         | Lint with ESLint                     |
| `npm run format`       | Format with Prettier                 |
| `npm run format:check` | Check formatting                     |
| `npm run db:generate`  | Generate database migrations         |
| `npm run db:migrate`   | Run database migrations              |
| `npm run db:push`      | Push schema changes to database      |
| `npm run db:seed`      | Seed database with test data         |
| `npm run db:studio`    | Open Drizzle Studio                  |

## Database

### Migrations

Schema changes use [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) migrations:

```bash
# Generate a migration from schema changes
npm run db:generate -- --name=describe-change

# Apply pending migrations
npm run db:migrate
```

Migrations are stored in `drizzle/` and tracked by a `__drizzle_migrations` table. Drizzle Kit has no built-in rollback — reverse migrations must be written manually.

**Convention:** Any migration that adds a table with an `updated_at` column must also add a trigger:

```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "table_name"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

The `update_updated_at()` function is created in the initial migration.

### Seed Data

```bash
npm run db:seed
```

Creates test users (`seed@quaynt.dev` and `member@quaynt.dev`, both with password `password123`), a workspace with both users, and API keys with different scopes. Safe to run multiple times (truncates before inserting). Refuses to run when `NODE_ENV=production`.

### Drizzle Studio

```bash
npm run db:studio
```

Opens a browser-based UI to browse and edit data in all tables.

## Project Structure

```
src/
├── app/                    # Next.js App Router (thin route handlers)
│   ├── [locale]/           # Locale-prefixed routes
│   │   ├── layout.tsx      # Locale layout (html, body, NextIntlClientProvider)
│   │   └── page.tsx        # Home page
│   ├── api/
│   │   ├── auth/           # Better Auth catch-all route
│   │   └── v1/             # Versioned API endpoints
│   │       ├── api-keys/   # API key management endpoints
│   │       ├── health/     # Health check and readiness probes
│   │       └── webhooks/   # Webhook management endpoints
│   └── layout.tsx          # Root layout (pass-through)
├── modules/                # Domain modules (business logic)
│   ├── auth/               # Authentication (config, session helpers, client, schema)
│   ├── webhooks/           # Webhook infrastructure (schemas, service, delivery engine, SSRF protection)
│   └── workspace/          # Workspace and API key services and schemas
├── lib/                    # Shared infrastructure
│   ├── api/                # API middleware, validation, rate limiting, pagination, CORS, response helpers
│   ├── config/             # Typed environment configuration
│   ├── logger/             # Structured logging (Pino)
│   ├── db/                 # Database client, schema barrel, ID generation, query helpers, connection pool
│   ├── i18n/               # Internationalization (routing, navigation, types)
│   └── jobs/               # pg-boss job queue client and handlers
├── middleware.ts            # Locale detection middleware
├── instrumentation.ts      # Next.js startup hook
└── worker.ts               # Standalone background worker
```

## Authentication

Quaynt uses [Better Auth](https://www.better-auth.com/) for user authentication with a dual-auth pattern:

- **Session cookies** for web UI — managed by Better Auth at `/api/auth/*`
- **API key Bearer tokens** for programmatic access — `Authorization: Bearer qk_...`

### Auth Endpoints (Better Auth)

| Route                     | Method | Description                  |
| ------------------------- | ------ | ---------------------------- |
| `/api/auth/sign-up/email` | POST   | Register with email/password |
| `/api/auth/sign-in/email` | POST   | Sign in                      |
| `/api/auth/sign-out`      | POST   | Sign out                     |
| `/api/auth/get-session`   | GET    | Get current session          |

### API Key Management

| Route                     | Method | Description                           |
| ------------------------- | ------ | ------------------------------------- |
| `/api/v1/api-keys`        | POST   | Create API key (admin scope required) |
| `/api/v1/api-keys`        | GET    | List API keys                         |
| `/api/v1/api-keys/:keyId` | GET    | Get API key details                   |
| `/api/v1/api-keys/:keyId` | DELETE | Revoke API key (admin scope required) |

API keys support three scopes: `read`, `read-write`, and `admin`. The plaintext key is returned only on creation.

### Protecting API Routes

API routes use a composable middleware pipeline. The canonical composition for authenticated endpoints:

```typescript
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { apiSuccess } from '@/lib/api/response';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          return apiSuccess({ workspaceId: auth.workspaceId });
        }, 'read')
      )
    )
  )
);
```

**Execution order:** request ID → request log → auth → rate limit → scope → handler

### Request Validation

Use `validateRequest` inside handlers for declarative Zod validation:

```typescript
import { validateRequest } from '@/lib/api/validation';

const result = await validateRequest(req, ctx, { body: mySchema });
if (!result.success) return result.response; // 400 or 422 auto-generated
const { body } = result.data; // fully typed
```

### Pagination

List endpoints support pagination, sorting, and filtering via query params:

```
GET /api/v1/api-keys?page=1&limit=10&sort=createdAt&order=desc
```

Responses follow the standard envelope: `{ data: [...], meta: { page, limit, total } }`

### API Framework Environment Variables

| Variable               | Default | Description                        |
| ---------------------- | ------- | ---------------------------------- |
| `RATE_LIMIT_POINTS`    | `100`   | Max requests per rate limit window |
| `RATE_LIMIT_DURATION`  | `60`    | Rate limit window in seconds       |
| `CORS_ALLOWED_ORIGINS` | `*`     | Comma-separated allowed origins    |

For the full auth architecture, see `docs/architecture/auth.md`.

### Webhooks

Quaynt supports webhooks for real-time event notifications to external systems.

| Route                                       | Method | Scope | Description                  |
| ------------------------------------------- | ------ | ----- | ---------------------------- |
| `/api/v1/webhooks`                          | POST   | admin | Create webhook endpoint      |
| `/api/v1/webhooks`                          | GET    | read  | List webhook endpoints       |
| `/api/v1/webhooks/:webhookId`               | GET    | read  | Get webhook endpoint details |
| `/api/v1/webhooks/:webhookId`               | PUT    | admin | Update webhook endpoint      |
| `/api/v1/webhooks/:webhookId`               | DELETE | admin | Delete webhook endpoint      |
| `/api/v1/webhooks/:webhookId/test`          | POST   | admin | Send test event              |
| `/api/v1/webhooks/:webhookId/secret/rotate` | POST   | admin | Rotate signing secret        |
| `/api/v1/webhooks/:webhookId/deliveries`    | GET    | read  | List delivery attempts       |

**Event types**: `citation.new`, `citation.updated`, `alert.triggered`, `report.generated`, `model_run.completed`, `webhook.test`

**Security**: Each endpoint has a unique HMAC-SHA256 signing secret. Deliveries include `X-Quaynt-Id`, `X-Quaynt-Timestamp`, and `X-Quaynt-Signature` headers for payload verification.

**Delivery**: At-least-once delivery with exponential backoff retry (up to 8 attempts over ~20 hours). Endpoints are auto-disabled after 5 days of consecutive failures.

**Worker**: Webhook delivery requires the background worker process (`npm run worker`).

#### Webhook Environment Variables

| Variable                   | Default | Description                            |
| -------------------------- | ------- | -------------------------------------- |
| `WEBHOOK_TIMEOUT_MS`       | `10000` | HTTP timeout for webhook delivery (ms) |
| `WEBHOOK_MAX_PAYLOAD_SIZE` | `65536` | Maximum webhook payload size (bytes)   |

## Internationalization (i18n)

Quaynt uses [next-intl](https://next-intl.dev/) for internationalization. All user-facing strings must use translation keys — never hardcode text in components.

### Using Translations

**Server Components** (default):

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function MyPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return <h1>{t('common.appName')}</h1>;
}
```

**Client Components:**

```typescript
'use client';
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('common');
  return <p>{t('appDescription')}</p>;
}
```

### Adding a New Translation Key

1. Add the key and English value to the appropriate file in `locales/en/` (e.g., `common.json` or `errors.json`)
2. Reference the key in your component: `t('namespace.key')`
3. TypeScript validates the key at compile time

### Adding a New Language

1. Create a new directory: `locales/{code}/` (e.g., `locales/de/`)
2. Copy the English files and translate the values (keys stay the same)
3. Add the locale code to `routing.locales` in `src/lib/i18n/routing.ts`

For the full i18n architecture, see `docs/architecture/i18n.md`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, standards, and requirements.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

See [LICENSE](LICENSE) for details.
