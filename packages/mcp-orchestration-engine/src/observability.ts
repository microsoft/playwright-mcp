import { listRecords, loadRecord } from './persistentMemory';

export function getExecution(taskId: string) {
  return loadRecord(taskId);
}

export function listRecentExecutions(limit = 20) {
  return listRecords(limit);
}
