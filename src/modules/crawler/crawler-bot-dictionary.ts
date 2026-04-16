import type { BotDefinition, BotMatch } from './crawler.types';

/**
 * AI-specific bot definitions ordered by specificity (longer/more specific patterns first).
 * Traditional search crawlers (Googlebot, bingbot, DuckDuckBot, Applebot) are excluded —
 * they predate AI search and would overwhelm the signal.
 *
 * Maintained via Dark Visitors (darkvisitors.com) and AI provider changelogs.
 */
const BOT_DICTIONARY: BotDefinition[] = [
  // Search/retrieval bots — match more specific variants first
  {
    name: 'OAI-SearchBot',
    category: 'search',
    operator: 'OpenAI',
    pattern: /OAI-SearchBot/i,
  },
  {
    name: 'ChatGPT-User',
    category: 'user_action',
    operator: 'OpenAI',
    pattern: /ChatGPT-User/i,
  },
  {
    name: 'GPTBot',
    category: 'search',
    operator: 'OpenAI',
    pattern: /GPTBot/i,
  },
  {
    name: 'Claude-SearchBot',
    category: 'search',
    operator: 'Anthropic',
    pattern: /Claude-SearchBot/i,
  },
  {
    name: 'Claude-User',
    category: 'user_action',
    operator: 'Anthropic',
    pattern: /Claude-User/i,
  },
  {
    name: 'ClaudeBot',
    category: 'search',
    operator: 'Anthropic',
    pattern: /ClaudeBot/i,
  },
  {
    name: 'anthropic-ai',
    category: 'training',
    operator: 'Anthropic',
    pattern: /anthropic-ai/i,
  },
  {
    name: 'PerplexityBot',
    category: 'search',
    operator: 'Perplexity',
    pattern: /PerplexityBot/i,
  },
  {
    name: 'Google-Extended',
    category: 'search',
    operator: 'Google',
    pattern: /Google-Extended/i,
  },
  {
    name: 'Applebot-Extended',
    category: 'search',
    operator: 'Apple',
    pattern: /Applebot-Extended/i,
  },
  {
    name: 'PhindBot',
    category: 'search',
    operator: 'Phind',
    pattern: /PhindBot/i,
  },
  {
    name: 'YouBot',
    category: 'search',
    operator: 'You.com',
    pattern: /YouBot/i,
  },
  // Training bots
  {
    name: 'CCBot',
    category: 'training',
    operator: 'Common Crawl',
    pattern: /CCBot/i,
  },
  {
    name: 'Bytespider',
    category: 'training',
    operator: 'ByteDance',
    pattern: /Bytespider/i,
  },
  {
    name: 'PetalBot',
    category: 'training',
    operator: 'Huawei',
    pattern: /PetalBot/i,
  },
  {
    name: 'Meta-ExternalAgent',
    category: 'training',
    operator: 'Meta',
    pattern: /Meta-ExternalAgent/i,
  },
  {
    name: 'Amazonbot',
    category: 'training',
    operator: 'Amazon',
    pattern: /Amazonbot/i,
  },
  {
    name: 'Diffbot',
    category: 'training',
    operator: 'Diffbot',
    pattern: /Diffbot/i,
  },
  {
    name: 'cohere-ai',
    category: 'training',
    operator: 'Cohere',
    pattern: /cohere-ai/i,
  },
  {
    name: 'AI2Bot',
    category: 'training',
    operator: 'Allen AI',
    pattern: /AI2Bot/i,
  },
  {
    name: 'Omgilibot',
    category: 'training',
    operator: 'Omgili',
    pattern: /Omgilibot/i,
  },
  {
    name: 'magpie-crawler',
    category: 'training',
    operator: 'Magpie',
    pattern: /magpie-crawler/i,
  },
];

/**
 * Quick-check substrings for fast rejection of non-bot user agents.
 * Most log lines won't match any AI bot — skip regex matching for them.
 */
const FAST_CHECK_SUBSTRINGS = BOT_DICTIONARY.map((bot) => bot.name.toLowerCase());

/**
 * Identifies an AI bot from a user-agent string.
 * Returns null for unknown user-agents and traditional search bots (Googlebot, bingbot, etc.).
 */
export function identifyBot(userAgent: string): BotMatch | null {
  if (!userAgent) return null;

  const lowerUA = userAgent.toLowerCase();

  // Fast rejection: check if the UA contains any known bot substring
  const hasCandidate = FAST_CHECK_SUBSTRINGS.some((substr) => lowerUA.includes(substr));
  if (!hasCandidate) return null;

  for (const bot of BOT_DICTIONARY) {
    if (bot.pattern.test(userAgent)) {
      return { name: bot.name, category: bot.category, operator: bot.operator };
    }
  }

  return null;
}

/** Returns the full bot dictionary (for UI display and testing). */
export function getBotDictionary(): readonly BotDefinition[] {
  return BOT_DICTIONARY;
}
