import {
  safeFetch,
  SafeFetchError,
  ONBOARDING_USER_AGENT,
  type SafeFetchOptions,
} from './safe-fetch';

const BOT_TOKEN = 'Quaynt-Onboarding';

export type RobotsCheckResult =
  | { allowed: true; reason: 'no_robots' | 'allowed' }
  | { allowed: false; reason: 'disallowed'; matchedPath: string };

/**
 * Fetch and parse robots.txt for the given origin and decide whether the path
 * is crawlable for our onboarding bot. Treats fetch errors as "no robots.txt"
 * (i.e., allowed), per the convention in the robots spec.
 *
 * Only checks the most-specific block (`Quaynt-Onboarding` first, then `*`).
 * Group merging across user-agent blocks and `Allow` overrides are intentionally
 * implemented for the cases that matter here — anything more would be a
 * heavyweight robots library, which is out of scope.
 */
export async function checkRobots(
  baseUrl: string,
  pathToCheck: string,
  fetchOpts: Pick<SafeFetchOptions, 'ipFilter'> = {}
): Promise<RobotsCheckResult> {
  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  let body: string;
  try {
    const result = await safeFetch(robotsUrl, {
      timeoutMs: 5000,
      maxBytes: 256 * 1024,
      maxRedirects: 2,
      accept: 'text/plain,*/*;q=0.5',
      allowNonOk: true,
      ipFilter: fetchOpts.ipFilter,
    });
    if (result.status === 404 || result.status >= 400) {
      return { allowed: true, reason: 'no_robots' };
    }
    body = result.body.toString('utf8');
  } catch (e) {
    if (
      e instanceof SafeFetchError &&
      (e.code === 'ssrf_rejected' || e.code === 'redirect_off_origin')
    ) {
      throw e;
    }
    return { allowed: true, reason: 'no_robots' };
  }

  const rules = parseRobots(body);
  const block = rules.byAgent.get(BOT_TOKEN.toLowerCase()) ?? rules.byAgent.get('*');
  if (!block) return { allowed: true, reason: 'allowed' };

  // Apply longest-match precedence between Allow and Disallow.
  let bestMatch: { allow: boolean; length: number; path: string } | null = null;
  for (const rule of block) {
    if (pathMatches(pathToCheck, rule.path)) {
      if (!bestMatch || rule.path.length > bestMatch.length) {
        bestMatch = { allow: rule.allow, length: rule.path.length, path: rule.path };
      }
    }
  }
  if (!bestMatch) return { allowed: true, reason: 'allowed' };
  if (bestMatch.allow) return { allowed: true, reason: 'allowed' };
  return { allowed: false, reason: 'disallowed', matchedPath: bestMatch.path };
}

type Rule = { allow: boolean; path: string };
type ParsedRobots = { byAgent: Map<string, Rule[]> };

function parseRobots(body: string): ParsedRobots {
  const byAgent = new Map<string, Rule[]>();
  let currentAgents: string[] = [];
  let lastDirectiveWasUserAgent = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const directive = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (directive === 'user-agent') {
      if (!lastDirectiveWasUserAgent) {
        currentAgents = [];
      }
      currentAgents.push(value.toLowerCase());
      lastDirectiveWasUserAgent = true;
      for (const agent of currentAgents) {
        if (!byAgent.has(agent)) byAgent.set(agent, []);
      }
      continue;
    }

    lastDirectiveWasUserAgent = false;
    if (directive !== 'allow' && directive !== 'disallow') continue;
    if (currentAgents.length === 0) continue;
    const rule: Rule = { allow: directive === 'allow', path: value };
    for (const agent of currentAgents) {
      const list = byAgent.get(agent);
      if (list) list.push(rule);
    }
  }

  return { byAgent };
}

function pathMatches(path: string, rulePath: string): boolean {
  if (rulePath === '') return false; // Empty Disallow per spec means "allow all" — no match.
  const anchorEnd = rulePath.endsWith('$');
  const inner = anchorEnd ? rulePath.slice(0, -1) : rulePath;
  if (inner.includes('*') || anchorEnd) {
    const pattern = inner.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const re = new RegExp('^' + pattern + (anchorEnd ? '$' : ''));
    return re.test(path);
  }
  return path.startsWith(inner);
}

function stripComment(line: string): string {
  const i = line.indexOf('#');
  return i < 0 ? line : line.slice(0, i);
}

export const ROBOTS_USER_AGENT_TOKEN = BOT_TOKEN;
export { ONBOARDING_USER_AGENT };
