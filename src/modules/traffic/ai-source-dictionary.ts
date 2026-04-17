import type { AiSourceDefinition, AiSourceMatch } from './traffic.types';

/**
 * AI source definitions used to classify incoming visits by referrer host or
 * utm_source query parameter. Ordered by specificity (longer/more specific hosts first).
 *
 * When ChatGPT Search rewrites outbound links it appends `?utm_source=chatgpt.com`, which
 * recovers attribution when the browser strips the Referer header (free ChatGPT users,
 * the iOS app, and `rel="noreferrer"` outbound links). This dual-signal approach is the
 * industry standard shared by Plausible, Fathom, and self-hosted analytics tools.
 *
 * Kept in sync with public analytics research (April 2026).
 */
const AI_SOURCES: AiSourceDefinition[] = [
  {
    platform: 'chatgpt',
    displayName: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com', 'openai.com'],
    utmSources: ['chatgpt.com', 'chatgpt', 'openai'],
    pattern: /(chatgpt\.com|chat\.openai\.com|openai\.com)/i,
  },
  {
    platform: 'perplexity',
    displayName: 'Perplexity',
    hosts: ['perplexity.ai', 'www.perplexity.ai'],
    utmSources: ['perplexity'],
    pattern: /perplexity\.ai/i,
  },
  {
    platform: 'gemini',
    displayName: 'Gemini',
    hosts: ['gemini.google.com', 'bard.google.com'],
    utmSources: ['gemini', 'bard'],
    pattern: /(gemini\.google\.com|bard\.google\.com)/i,
  },
  {
    platform: 'claude',
    displayName: 'Claude',
    hosts: ['claude.ai'],
    utmSources: ['claude', 'claude.ai'],
    pattern: /claude\.ai/i,
  },
  {
    platform: 'copilot',
    displayName: 'Microsoft Copilot',
    // bing.com is intentionally excluded from hosts — the browser-supplied Referer header
    // collapses to the origin, so bing.com/chat and bing.com/search are indistinguishable.
    // Copilot now runs on copilot.microsoft.com; older /chat URLs redirect there.
    hosts: ['copilot.microsoft.com'],
    utmSources: ['copilot', 'bing-copilot'],
    pattern: /copilot\.microsoft\.com/i,
  },
  {
    platform: 'you',
    displayName: 'You.com',
    hosts: ['you.com'],
    utmSources: ['you.com', 'you'],
    pattern: /(^|\.)you\.com/i,
  },
  {
    platform: 'brave',
    displayName: 'Brave Search AI',
    hosts: ['search.brave.com'],
    utmSources: ['brave'],
    pattern: /search\.brave\.com/i,
  },
  {
    platform: 'grok',
    displayName: 'Grok',
    hosts: ['grok.com', 'x.com'],
    utmSources: ['grok'],
    // Grok chat lives on grok.com and x.com/i/grok — match either.
    pattern: /(grok\.com|x\.com\/i\/grok)/i,
  },
  {
    platform: 'deepseek',
    displayName: 'DeepSeek',
    hosts: ['chat.deepseek.com', 'deepseek.com'],
    utmSources: ['deepseek'],
    pattern: /deepseek\.com/i,
  },
  {
    platform: 'meta-ai',
    displayName: 'Meta AI',
    hosts: ['meta.ai'],
    utmSources: ['meta-ai', 'metaai'],
    pattern: /(^|\.)meta\.ai/i,
  },
  {
    platform: 'mistral',
    displayName: 'Le Chat (Mistral)',
    hosts: ['chat.mistral.ai'],
    utmSources: ['mistral', 'le-chat'],
    pattern: /chat\.mistral\.ai/i,
  },
  {
    platform: 'phind',
    displayName: 'Phind',
    hosts: ['phind.com', 'www.phind.com'],
    utmSources: ['phind'],
    pattern: /phind\.com/i,
  },
  {
    platform: 'andi',
    displayName: 'Andi',
    hosts: ['andisearch.com'],
    utmSources: ['andi', 'andisearch'],
    pattern: /andisearch\.com/i,
  },
];

/**
 * Lowercased substring hooks for fast rejection of non-AI referrers. Most referrers won't
 * match any AI source — skip regex evaluation for them. Mirrors the optimization in
 * `crawler-bot-dictionary.ts`.
 */
const FAST_CHECK_SUBSTRINGS: readonly string[] = Array.from(
  new Set(AI_SOURCES.flatMap((source) => source.hosts.map((host) => host.toLowerCase())))
);

/**
 * Safely extract a lowercase hostname from a referrer URL. Returns null for malformed
 * input — callers treat missing referrers as "no signal" rather than throwing.
 */
function safeHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Classifies a visit by its referrer URL and utm_source query parameter. Tries the
 * referrer first (stronger signal) and falls back to utm_source to recover attribution
 * when the Referer header is stripped. Returns null for visits that match neither.
 */
export function identifyAiSource(
  referrer: string | null | undefined,
  utmSource: string | null | undefined
): AiSourceMatch | null {
  const host = safeHost(referrer);
  const lowerHost = host ?? '';
  const lowerUtm = utmSource ? utmSource.toLowerCase().trim() : '';

  // Fast rejection: if neither signal contains any known AI host substring and no utm
  // value is present, skip the regex sweep.
  const hostCandidate =
    lowerHost.length > 0 && FAST_CHECK_SUBSTRINGS.some((sub) => lowerHost.includes(sub));
  const utmCandidate = lowerUtm.length > 0;
  if (!hostCandidate && !utmCandidate) return null;

  // Referrer-based match.
  if (hostCandidate) {
    for (const source of AI_SOURCES) {
      if (source.hosts.some((h) => lowerHost === h || lowerHost.endsWith(`.${h}`))) {
        return { platform: source.platform, displayName: source.displayName, via: 'referrer' };
      }
      if (source.pattern.test(lowerHost)) {
        return { platform: source.platform, displayName: source.displayName, via: 'referrer' };
      }
    }
  }

  // utm_source fallback — exact match against the curated list per source.
  if (utmCandidate) {
    for (const source of AI_SOURCES) {
      if (source.utmSources?.some((u) => u.toLowerCase() === lowerUtm)) {
        return { platform: source.platform, displayName: source.displayName, via: 'utm' };
      }
    }
  }

  return null;
}

/** Returns the full AI source dictionary (for UI display and testing). */
export function getAiSourceDictionary(): readonly AiSourceDefinition[] {
  return AI_SOURCES;
}

/** Returns the platform slug → display name map used by the analytics UI. */
export function getPlatformDisplayName(platform: string): string {
  const match = AI_SOURCES.find((s) => s.platform === platform);
  return match?.displayName ?? platform;
}
