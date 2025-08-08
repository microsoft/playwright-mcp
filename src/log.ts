// @ts-nocheck
import debug from 'debug';

const errorsDebug = debug('pw:mcp:errors');
const requestsDebug = debug('pw:mcp:requests');
export function logUnhandledError(error: unknown) {
  errorsDebug(error);
}
export const testDebug = debug('pw:mcp:test');
export const requestDebug = requestsDebug;
