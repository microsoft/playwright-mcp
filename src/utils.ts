import { createHash as cryptoCreateHash } from 'node:crypto';
export function createHash(data: string): string {
  return cryptoCreateHash('sha256').update(data).digest('hex').slice(0, 7);
}
// Regex to match filesystem unsafe characters (excluding control characters)
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]+/g;

// Remove control characters (0x00-0x1F and 0x7F) to avoid regex warnings and ensure filesystem safety
function removeControlCharacters(str: string): string {
  // Use string methods to remove control characters to avoid regex warnings
  return str
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      return (code >= 0 && code <= 31) || code === 127 ? '-' : char;
    })
    .join('');
}

export function sanitizeForFilePath(input: string) {
  const sanitize = (str: string) => {
    // First remove control characters, then unsafe filename characters
    const cleanStr = removeControlCharacters(str);
    return cleanStr.replace(UNSAFE_FILENAME_CHARS, '-');
  };
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
