export const RESERVED_VARIABLES = ['brand', 'locale', 'market'] as const;

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function extractVariables(template: string): string[] {
  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    variables.add(match[1].toLowerCase());
  }

  return [...variables];
}

export function interpolateTemplate(template: string, variables: Record<string, string>): string {
  const lowercaseVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    lowercaseVars[key.toLowerCase()] = value;
  }

  return template.replace(VARIABLE_PATTERN, (original, name: string) => {
    const value = lowercaseVars[name.toLowerCase()];
    return value !== undefined ? value : original;
  });
}
