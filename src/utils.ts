import { createHash as cryptoCreateHash } from 'node:crypto';
export function createHash(data: string): string {
  return cryptoCreateHash('sha256').update(data).digest('hex').slice(0, 7);
}
// Regex to match filesystem unsafe characters (excluding control characters)
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]+/g;

// Remove control characters (0x00-0x1F) to avoid regex warnings and ensure filesystem safety
function removeControlCharacters(str: string): string {
  return str
    .split('')
    .map((char) => {
      const charCode = char.charCodeAt(0);
      return charCode <= 31 ? '-' : char;
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
