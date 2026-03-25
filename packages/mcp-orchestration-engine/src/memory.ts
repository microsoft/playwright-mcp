import { ExecutionRecord } from './types';

const store = new Map<string, ExecutionRecord>();

export function createRecord(taskId: string): ExecutionRecord {
  const now = new Date().toISOString();
  const record: ExecutionRecord = {
    taskId,
    status: 'queued',
    createdAt: now,
    updatedAt: now
  };
  store.set(taskId, record);
  return record;
}

export function updateRecord(taskId: string, patch: Partial<ExecutionRecord>): ExecutionRecord {
  const existing = store.get(taskId);
  if (!existing) throw new Error('Record not found');

  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  store.set(taskId, updated);
  return updated;
}

export function getRecord(taskId: string): ExecutionRecord | undefined {
  return store.get(taskId);
}
