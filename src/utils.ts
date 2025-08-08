import { createHash as cryptoCreateHash } from 'node:crypto';
export function createHash(data: string): string {
  return cryptoCreateHash('sha256').update(data).digest('hex').slice(0, 7);
}
export function sanitizeForFilePath(input: string) {
  const sanitize = (str: string) =>
    str.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
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
