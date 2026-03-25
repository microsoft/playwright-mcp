type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: meta || {}
  };

  // stdout structured logs (can be piped to external systems)
  console.log(JSON.stringify(entry));
}

export function logExecutionEvent(event: string, data: Record<string, unknown>) {
  log('info', event, data);
}
