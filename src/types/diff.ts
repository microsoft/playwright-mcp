// @ts-nocheck
export interface DiffOptions {
  enabled: boolean;
  threshold: number;
  format: 'unified' | 'split' | 'minimal';
  maxDiffLines: number;
  ignoreWhitespace: boolean;
  context: number;
}
export interface DiffSegment {
  type: 'add' | 'remove' | 'equal';
  value: string;
}
export interface DiffMetadata {
  addedLines: number;
  removedLines: number;
  contextLines: number;
  totalLines: number;
}
export interface DiffResult {
  hasDifference: boolean;
  similarity: number;
  formattedDiff: string;
  metadata: DiffMetadata;
}
export interface ResponseStorage {
  toolName: string;
  timestamp: number;
  content: string;
  hash: string;
}
