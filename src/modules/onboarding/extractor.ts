import { parse, type HTMLElement } from 'node-html-parser';
import { safeFetch, SafeFetchError, type SafeFetchOptions } from './safe-fetch';

export type ExtractSiteResult = {
  brandName: string;
  aliases: string[];
  description: string | null;
  categories: string[];
};

export type ExtractSiteErrorCode =
  | 'fetch_failed'
  | 'non_html_response'
  | 'parse_failed'
  | 'no_brand_signal';

export class ExtractSiteError extends Error {
  readonly code: ExtractSiteErrorCode;
  constructor(code: ExtractSiteErrorCode, message: string) {
    super(message);
    this.name = 'ExtractSiteError';
    this.code = code;
  }
}

const MAX_FIELD_CHARS = 240;
const MAX_DESCRIPTION_CHARS = 600;
const MAX_ALIASES = 6;
const MAX_CATEGORIES = 6;

/**
 * Best-effort brand identity extraction from a public homepage (and `/about`
 * if reachable). Signals in priority order:
 *   1. og:site_name
 *   2. og:title
 *   3. schema.org Organization name (JSON-LD)
 *   4. <title> (with site-suffix stripping)
 *   5. <h1>
 * Description: og:description → <meta name="description">.
 * Categories: shallow heuristic — repeated heading words + JSON-LD knowsAbout.
 *
 * Raw HTML is never returned to the caller.
 */
export async function extractSite(
  baseUrl: string,
  fetchOpts: Pick<SafeFetchOptions, 'ipFilter'> = {}
): Promise<ExtractSiteResult> {
  const homeHtml = await fetchHtml(baseUrl, fetchOpts);
  const aboutHtml = await fetchHtmlOptional(joinUrl(baseUrl, '/about'), fetchOpts);

  const home = parseSafe(homeHtml);
  const about = aboutHtml ? parseSafe(aboutHtml) : null;

  const ogSiteName = pickMeta(home, 'og:site_name');
  const ogTitle = pickMeta(home, 'og:title');
  const jsonLd = collectJsonLdOrg([home, about]);
  const titleTag = home.querySelector('title')?.text ?? null;
  const h1 = home.querySelector('h1')?.text ?? null;

  let brandName: string | null = null;
  if (ogSiteName) brandName = clean(ogSiteName, MAX_FIELD_CHARS);
  if (!brandName && jsonLd?.name) brandName = clean(jsonLd.name, MAX_FIELD_CHARS);
  if (!brandName && ogTitle) brandName = clean(stripSiteSuffix(ogTitle), MAX_FIELD_CHARS);
  if (!brandName && titleTag) brandName = clean(stripSiteSuffix(titleTag), MAX_FIELD_CHARS);
  if (!brandName && h1) brandName = clean(h1, MAX_FIELD_CHARS);

  if (!brandName) {
    // Last-ditch: derive from hostname (capitalize root label).
    try {
      const host = new URL(baseUrl).hostname.replace(/^www\./, '');
      const root = host.split('.')[0] ?? '';
      brandName = root ? root[0]!.toUpperCase() + root.slice(1) : '';
    } catch {
      brandName = '';
    }
  }
  if (!brandName) {
    throw new ExtractSiteError('no_brand_signal', 'Could not infer a brand name from the page.');
  }

  const description =
    pickMeta(home, 'og:description') ??
    pickMetaName(home, 'description') ??
    jsonLd?.description ??
    null;

  const aliasSet = new Set<string>();
  if (jsonLd?.alternateName) {
    if (Array.isArray(jsonLd.alternateName)) {
      for (const a of jsonLd.alternateName) aliasSet.add(clean(a, MAX_FIELD_CHARS));
    } else {
      aliasSet.add(clean(jsonLd.alternateName, MAX_FIELD_CHARS));
    }
  }
  if (jsonLd?.legalName) aliasSet.add(clean(jsonLd.legalName, MAX_FIELD_CHARS));
  aliasSet.delete(brandName);
  aliasSet.delete('');
  const aliases = Array.from(aliasSet).slice(0, MAX_ALIASES);

  const categories = collectCategories([home, about], jsonLd, brandName).slice(0, MAX_CATEGORIES);

  return {
    brandName,
    aliases,
    description: description ? clean(description, MAX_DESCRIPTION_CHARS) : null,
    categories,
  };
}

async function fetchHtml(
  url: string,
  fetchOpts: Pick<SafeFetchOptions, 'ipFilter'>
): Promise<string> {
  let result;
  try {
    result = await safeFetch(url, { ipFilter: fetchOpts.ipFilter });
  } catch (e) {
    if (e instanceof SafeFetchError) {
      throw new ExtractSiteError('fetch_failed', e.message);
    }
    throw new ExtractSiteError('fetch_failed', (e as Error).message);
  }
  if (!result.contentType || !/(text\/html|application\/xhtml)/i.test(result.contentType)) {
    throw new ExtractSiteError(
      'non_html_response',
      `Unexpected Content-Type: ${result.contentType ?? 'none'}`
    );
  }
  return result.text;
}

async function fetchHtmlOptional(
  url: string,
  fetchOpts: Pick<SafeFetchOptions, 'ipFilter'>
): Promise<string | null> {
  try {
    return await fetchHtml(url, fetchOpts);
  } catch {
    return null;
  }
}

function parseSafe(html: string): HTMLElement {
  try {
    return parse(html, { lowerCaseTagName: false, comment: false });
  } catch (e) {
    throw new ExtractSiteError('parse_failed', (e as Error).message);
  }
}

function pickMeta(root: HTMLElement, property: string): string | null {
  const el = root.querySelector(`meta[property="${property}"]`);
  return el?.getAttribute('content') ?? null;
}

function pickMetaName(root: HTMLElement, name: string): string | null {
  const el = root.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute('content') ?? null;
}

type JsonLdOrg = {
  name?: string;
  alternateName?: string | string[];
  legalName?: string;
  description?: string;
  knowsAbout?: string | string[];
};

function collectJsonLdOrg(roots: (HTMLElement | null)[]): JsonLdOrg | null {
  for (const root of roots) {
    if (!root) continue;
    const scripts = root.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const text = script.text;
      if (!text) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      const found = findOrganization(parsed);
      if (found) return found;
    }
  }
  return null;
}

function findOrganization(value: unknown): JsonLdOrg | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOrganization(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (
    types.some((t) => typeof t === 'string' && /Organization|Corporation|LocalBusiness/i.test(t))
  ) {
    return {
      name: typeof obj.name === 'string' ? obj.name : undefined,
      alternateName: normalizeStringOrArray(obj.alternateName),
      legalName: typeof obj.legalName === 'string' ? obj.legalName : undefined,
      description: typeof obj.description === 'string' ? obj.description : undefined,
      knowsAbout: normalizeStringOrArray(obj.knowsAbout),
    };
  }
  // Recurse into @graph and other nested fields.
  for (const v of Object.values(obj)) {
    const found = findOrganization(v);
    if (found) return found;
  }
  return null;
}

function normalizeStringOrArray(v: unknown): string | string[] | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.every((s) => typeof s === 'string')) return v as string[];
  return undefined;
}

function collectCategories(
  roots: (HTMLElement | null)[],
  jsonLd: JsonLdOrg | null,
  brandName: string
): string[] {
  const categories: string[] = [];
  if (jsonLd?.knowsAbout) {
    const arr = Array.isArray(jsonLd.knowsAbout) ? jsonLd.knowsAbout : [jsonLd.knowsAbout];
    for (const c of arr) categories.push(clean(c, MAX_FIELD_CHARS));
  }
  // Heuristic: H2 / nav text frequencies, excluding brand name.
  const headings = new Map<string, number>();
  for (const root of roots) {
    if (!root) continue;
    for (const h of root.querySelectorAll('h2, h3, nav a')) {
      const text = h.text?.trim() ?? '';
      if (text.length < 3 || text.length > 60) continue;
      if (text.toLowerCase().includes(brandName.toLowerCase())) continue;
      const key = text;
      headings.set(key, (headings.get(key) ?? 0) + 1);
    }
  }
  for (const [text] of [...headings.entries()].sort((a, b) => b[1] - a[1])) {
    if (categories.length >= MAX_CATEGORIES) break;
    if (categories.includes(text)) continue;
    categories.push(text);
  }
  return categories;
}

function clean(input: string, maxChars: number): string {
  let out = decodeEntities(input).replace(/\s+/g, ' ').trim();
  if (out.length > maxChars) out = out.slice(0, maxChars).trimEnd() + '…';
  return out;
}

function stripSiteSuffix(input: string): string {
  // Common patterns: "Brand | Tagline" or "Brand - Tagline" or "Brand: Tagline"
  return input.split(/\s+[-|–—:·]\s+/)[0]!.trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function joinUrl(base: string, path: string): string {
  try {
    return new URL(path, base).toString();
  } catch {
    return base;
  }
}
