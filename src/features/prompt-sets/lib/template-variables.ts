/**
 * Utilities for extracting and rendering template variables
 * from prompt templates (e.g., "What is {{brand}} in {{locale}}?").
 */

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/** Known variables that Quaynt substitutes during model runs. */
export const KNOWN_VARIABLES = ['brand', 'locale', 'market'] as const;

/**
 * Extracts unique variable names from a template string.
 * Returns deduplicated names in order of first appearance.
 */
export function extractVariables(template: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  VARIABLE_REGEX.lastIndex = 0;
  while ((match = VARIABLE_REGEX.exec(template)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }

  return result;
}

/**
 * Replaces {{varName}} placeholders with provided values.
 * Variables without a provided value are left as-is.
 */
export function renderPreview(template: string, values?: Record<string, string>): string {
  if (!values) return template;
  return template.replace(VARIABLE_REGEX, (match, name: string) => {
    return name in values ? values[name] : match;
  });
}
