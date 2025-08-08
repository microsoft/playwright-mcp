import { createHash as cryptoCreateHash } from 'node:crypto';
export function createHash(data: string): string {
  return cryptoCreateHash('sha256').update(data).digest('hex').slice(0, 7);
}
// Regex to match file system unsafe characters
// biome-ignore lint/suspicious/noControlCharactersInRegex: Control characters are intentionally excluded for filesystem safety
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]+/g;

export function sanitizeForFilePath(input: string) {
  const sanitize = (str: string) => str.replace(UNSAFE_FILENAME_CHARS, '-');
  const separator = input.lastIndexOf('.');
  if (separator === -1) {
    return sanitize(input);
  }
  return (
    sanitize(input.substring(0, separator)) +
    '.' +
    sanitize(input.substring(separator + 1))
  );
}
