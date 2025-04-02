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

test('test qa with single url', async ({ qaClient }) => {
  const response = await qaClient.callTool({
    name: 'browser_qa',
    arguments: {
      urls: ['data:text/html,<html><title>Test Page</title><button>Click me</button><input type="text" placeholder="Type here"/></html>']
    }
  });

  // Verify response contains snapshot and batch information
  console.log(response)
});