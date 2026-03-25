import fs from 'fs';
import path from 'path';

import { ExecutionRecord } from './types';

const DATA_DIR = process.env.MCP_ORCHESTRATOR_DATA_DIR || path.join(process.cwd(), '.mcp-orchestrator');
const RECORDS_PATH = path.join(DATA_DIR, 'records.json');

function ensureStore(): void {
  if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RECORDS_PATH))
    fs.writeFileSync(RECORDS_PATH, JSON.stringify({}, null, 2));
}

function readAll(): Record<string, ExecutionRecord> {
  ensureStore();
  return JSON.parse(fs.readFileSync(RECORDS_PATH, 'utf-8')) as Record<string, ExecutionRecord>;
}

function writeAll(records: Record<string, ExecutionRecord>): void {
  ensureStore();
  fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2));
}

export function persistRecord(record: ExecutionRecord): ExecutionRecord {
  const records = readAll();
  records[record.taskId] = record;
  writeAll(records);
  return record;
}

export function loadRecord(taskId: string): ExecutionRecord | undefined {
  const records = readAll();
  return records[taskId];
}

export function listRecords(limit = 50): ExecutionRecord[] {
  const records = Object.values(readAll());
  return records
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
