import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess } from '@/lib/api/response';
import { createBoss } from '@/lib/jobs/boss';
import { runSimulationPipeline } from '@/modules/query-fanout/query-fanout-simulator.pipeline';
import {
  SimulationError,
  SimulationNoProviderError,
  SimulationParseError,
  SimulationRateLimitError,
  SimulationTimeoutError,
} from '@/modules/query-fanout/query-fanout-simulator.types';

const SIMULATION_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

const simulateBodySchema = z.object({
  promptId: z.string().min(1),
  modelRunId: z.string().min(1).optional(),
  modelRunResultId: z.string().min(1).optional(),
  options: z
    .object({
      provider: z.enum(SIMULATION_PROVIDERS).optional(),
      modelOverride: z.string().min(1).max(200).optional(),
      subQueryTarget: z.number().int().positive().max(50).optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
});

/**
 * POST /api/v1/visibility/query-fanout/simulate
 *
 * Run an LLM-simulated query fan-out for a prompt. Synchronous (blocks up to
 * the 15s simulator timeout). Errors in the simulator itself are returned as
 * a 200 envelope with `meta.status: 'simulation_failed'` and a specific
 * `meta.reason` so the UI can render targeted guidance.
 *
 * Body:
 *   { promptId: string, modelRunId?: string, modelRunResultId?: string,
 *     options?: { provider?, modelOverride?, subQueryTarget?, temperature? } }
 *
 * Response (happy path):
 *   { data: { simulation: SimulationResult, nodesInserted: number } }
 *
 * Response (simulator-layer failure):
 *   { data: null, meta: { status: 'simulation_failed', reason: string, retryAfterMs?: number } }
 *
 * Response (endpoint rate limit): 429 standard envelope.
 */
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, { body: simulateBodySchema });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const boss = createBoss();

          try {
            const result = await runSimulationPipeline({
              workspaceId: auth.workspaceId,
              promptId: validated.data.body.promptId,
              modelRunId: validated.data.body.modelRunId,
              modelRunResultId: validated.data.body.modelRunResultId,
              options: validated.data.body.options,
              boss,
            });

            if (!result.promptFound) {
              // Consistent with other visibility endpoints: empty data on
              // cross-workspace access rather than 404.
              return apiSuccess({ data: null });
            }

            return apiSuccess({
              data: {
                simulation: result.simulation,
                nodesInserted: result.nodesInserted,
              },
            });
          } catch (err) {
            return apiSuccess(buildSimulationFailure(err));
          }
        }, 'read-write'),
        { points: 30, duration: 60, keyPrefix: 'rl_api_simulate' }
      )
    )
  )
);

interface SimulationFailureBody {
  data: null;
  meta: {
    status: 'simulation_failed';
    reason: string;
    retryAfterMs?: number;
  };
}

function buildSimulationFailure(err: unknown): SimulationFailureBody {
  if (err instanceof SimulationNoProviderError) {
    return {
      data: null,
      meta: { status: 'simulation_failed', reason: 'no_simulation_provider_configured' },
    };
  }
  if (err instanceof SimulationRateLimitError) {
    return {
      data: null,
      meta: {
        status: 'simulation_failed',
        reason: 'simulation_rate_limited',
        ...(err.retryAfterMs !== null ? { retryAfterMs: err.retryAfterMs } : {}),
      },
    };
  }
  if (err instanceof SimulationTimeoutError) {
    return {
      data: null,
      meta: { status: 'simulation_failed', reason: 'simulation_timeout' },
    };
  }
  if (err instanceof SimulationParseError) {
    return {
      data: null,
      meta: { status: 'simulation_failed', reason: 'simulation_parse_failed' },
    };
  }
  if (err instanceof SimulationError) {
    return {
      data: null,
      meta: { status: 'simulation_failed', reason: err.code },
    };
  }
  // Unknown error — still return a 200 envelope so the UI degrades gracefully.
  return {
    data: null,
    meta: { status: 'simulation_failed', reason: 'simulation_failed' },
  };
}
