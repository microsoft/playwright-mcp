import fs from 'fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test, expect } from './fixtures';

test('test tool list', async ({ qaClient }) => {
    const { tools: qaTools } = await qaClient.listTools();
    expect(qaTools.map(t => t.name)).toEqual([
      'browser_qa'
    ]);
});