# Query Fan-Out Module

Captures the **observed** decomposition tree — sub-queries and the sources
feeding each — from data the platform adapters already pull out of
`model_run_result.rawResponse`. No SERP scraping.

## Scope (6.3a)

This is the observed half of feature 6.3. The simulated half (LLM-generated
sub-queries for platforms that do not expose native decomposition) is 6.3b.

## File layout

| File                             | Purpose                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `query-fanout.types.ts`          | Shared tree types (`ObservedFanoutTree`, `QueryFanoutNodeRow`, API response shapes)                    |
| `query-fanout.schema.ts`         | Drizzle schema + pgEnum for `query_fanout_node`                                                        |
| `query-fanout.extractor.ts`      | Dispatcher that routes by `platformId` to the per-adapter extractor                                    |
| `query-fanout.service.ts`        | `runQueryFanoutForResult`, `getFanoutByModelRun`, `getFanoutByModelRunResult`, `deleteFanoutForResult` |
| `query-fanout.service.test.ts`   | Unit tests for the service                                                                             |
| `query-fanout.extractor.test.ts` | Dispatcher tests                                                                                       |

Per-adapter extractors live co-located with their adapters:

- `src/modules/adapters/gemini/gemini.query-fanout.ts`
- `src/modules/adapters/aio/aio.query-fanout.ts`
- `src/modules/adapters/chatgpt/chatgpt.query-fanout.ts`

## Public interface

```ts
import {
  runQueryFanoutForResult,
  getFanoutByModelRun,
  getFanoutByModelRunResult,
} from '@/modules/query-fanout/query-fanout.service';
import { extractObservedFanout } from '@/modules/query-fanout/query-fanout.extractor';
```

## How it integrates

- **Extraction** runs inside the existing `citation-extract` pg-boss handler
  (`src/modules/citations/citation.pipeline.ts`) after citations are inserted.
  There is no separate fan-out job, no new queue, no new cron.
- **Failure isolation** — extractor errors are caught inside
  `runQueryFanoutForResult`. Citations and the enclosing job are never rolled
  back by fan-out failures.
- **Idempotency** — the service deletes existing rows for the result before
  inserting, inside a transaction. The table also carries a unique constraint
  on `(modelRunResultId, parentNodeId, kind, subQueryText, sourceUrl)` with
  `NULLS NOT DISTINCT` as a backstop.
- **Webhook** — `query_fanout.extracted` fires per result with node counts
  only (no node text).
- **URL normalisation** reuses `@/modules/citations/url-normalize` so the
  fan-out rows' `normalizedUrl` matches the citation table's and `citationId`
  reconciliation works.

## Non-goals for 6.3a

- No SERP scraping. AI Overview data arrives through already-integrated SERP
  providers.
- No LLM-simulated fan-out. Deferred to 6.3b.
- No Perplexity sub-query support (Perplexity's API returns a flat result
  list with no decomposition). Shows "not available on this platform" in
  the UI.
- No per-sub-query source attribution for Gemini (not exposed by the API)
  or ChatGPT (Responses API returns a flat annotations list).
