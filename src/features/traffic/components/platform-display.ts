/**
 * Display-name map for platform slugs. Kept in the frontend to avoid re-fetching a tiny
 * static mapping on every page load. Mirrors the `displayName` field in
 * `ai-source-dictionary.ts`.
 */
export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  copilot: 'Microsoft Copilot',
  you: 'You.com',
  brave: 'Brave Search AI',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  'meta-ai': 'Meta AI',
  mistral: 'Le Chat (Mistral)',
  phind: 'Phind',
  andi: 'Andi',
};
