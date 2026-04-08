import { listBrands } from '@/modules/brands/brand.service';
import type { DashboardFilters, DashboardResponse, DashboardPromptSet } from './dashboard.types';
import type { ResolvedContext } from './dashboard.context';
import { resolvePromptSet, resolveDataAsOf, resolveDefaultDates } from './dashboard.context';
import { computeKPIs } from './dashboard.kpis';
import {
  getTopMovers,
  getTopOpportunities,
  getPlatformStatuses,
  getAlertData,
} from './dashboard.sections';

export async function getDashboardData(
  workspaceId: string,
  filters?: DashboardFilters
): Promise<DashboardResponse> {
  // 1. Resolve prompt set
  const resolved = await resolvePromptSet(workspaceId, filters?.promptSetId);
  if (filters?.promptSetId && !resolved) {
    const err = new Error('PROMPT_SET_NOT_FOUND');
    (err as Error & { code: string }).code = 'PROMPT_SET_NOT_FOUND';
    throw err;
  }

  const dashboardPromptSet: DashboardPromptSet = resolved ?? { id: '', name: '' };

  // 2. Resolve dates
  const period = resolveDefaultDates(filters?.from, filters?.to);

  // 3. Fetch brands
  const brandResult = await listBrands(workspaceId, { page: 1, limit: 100, order: 'asc' });
  const brandMap = new Map(brandResult.items.map((b) => [b.id, b.name]));

  const ctx: ResolvedContext = {
    workspaceId,
    promptSetId: dashboardPromptSet.id,
    promptSetName: dashboardPromptSet.name,
    from: period.from,
    to: period.to,
    brandMap,
  };

  // 4. Fan out to all sections via allSettled
  const [kpisResult, moversResult, opportunitiesResult, platformsResult, alertsResult] =
    await Promise.allSettled([
      dashboardPromptSet.id ? computeKPIs(ctx) : Promise.resolve(null),
      dashboardPromptSet.id ? getTopMovers(ctx) : Promise.resolve([]),
      dashboardPromptSet.id ? getTopOpportunities(ctx) : Promise.resolve([]),
      getPlatformStatuses(workspaceId),
      getAlertData(workspaceId),
    ]);

  // 5. Assemble response with graceful degradation
  const warnings: string[] = [];

  const kpis = extractResult(kpisResult, 'kpis', warnings);
  const movers = extractResult(moversResult, 'movers', warnings);
  const opportunities = extractResult(opportunitiesResult, 'opportunities', warnings);
  const platforms = extractResult(platformsResult, 'platforms', warnings);
  const alerts = extractResult(alertsResult, 'alerts', warnings);

  // If no prompt set was resolved (and none was explicitly requested), add warning
  if (!resolved && !filters?.promptSetId) {
    warnings.push('No prompt set found — dashboard data may be empty');
  }

  // 6. Check if ALL sections failed
  if (
    kpis === null &&
    movers === null &&
    opportunities === null &&
    platforms === null &&
    alerts === null
  ) {
    const err = new Error('ALL_SECTIONS_FAILED');
    (err as Error & { code: string; warnings: string[] }).code = 'ALL_SECTIONS_FAILED';
    (err as Error & { code: string; warnings: string[] }).warnings = warnings;
    throw err;
  }

  // 7. Resolve dataAsOf
  const dataAsOf = dashboardPromptSet.id
    ? await resolveDataAsOf(workspaceId, dashboardPromptSet.id)
    : new Date().toISOString();

  const response: DashboardResponse = {
    kpis,
    movers,
    opportunities,
    platforms,
    alerts,
    dataAsOf,
    promptSet: dashboardPromptSet,
    period,
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  return response;
}

function extractResult<T>(
  result: PromiseSettledResult<T>,
  section: string,
  warnings: string[]
): T | null {
  if (result.status === 'fulfilled') return result.value;
  warnings.push(`Could not load ${section} data`);
  return null;
}
