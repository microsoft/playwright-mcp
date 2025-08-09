// adapted from:
// - https://github.com/microsoft/playwright/blob/76ee48dc9d4034536e3ec5b2c7ce8be3b79418a8/packages/playwright-core/src/utils/isomorphic/stringUtils.ts
// - https://github.com/microsoft/playwright/blob/76ee48dc9d4034536e3ec5b2c7ce8be3b79418a8/packages/playwright-core/src/server/codegen/javascript.ts
// NOTE: this function should not be used to escape any selectors.
export function escapeWithQuotes(text: string, char = "'") {
  const stringified = JSON.stringify(text);
  const escapedText = stringified
    .substring(1, stringified.length - 1)
    .replace(/\\"/g, '"');
  if (char === "'") {
    return char + escapedText.replace(/'/g, "'") + char;
  }
  if (char === '"') {
    return char + escapedText.replace(/"/g, '"') + char;
  }
  if (char === '`') {
    return char + escapedText.replace(/`/g, '`') + char;
  }
  throw new Error('Invalid escape char');
}
export function quote(text: string) {
  return escapeWithQuotes(text, "'");
}
export function formatObject(value: unknown, indent = '  '): string {
  if (typeof value === 'string') {
    return quote(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((o) => formatObject(o)).join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((key) => obj[key] !== undefined)
      .sort((a: string, b: string) => a.localeCompare(b));
    if (!keys.length) {
      return '{}';
    }
    const tokens: string[] = [];
    for (const key of keys) {
      tokens.push(`${key}: ${formatObject(obj[key])}`);
    }
    const separator = `,\n${indent}`;
    return `{\n${indent}${tokens.join(separator)}\n}`;
  }
  return String(value);
}
