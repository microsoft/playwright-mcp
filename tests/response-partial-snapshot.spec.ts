import { test, expect } from './fixtures.js';

test.describe('Response partial snapshot implementation', () => {
  test('should use capturePartialSnapshot when selector is provided', async ({ client, server }) => {
    server.setContent('/', `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <header>Header Content</header>
          <main>
            <h1>Main Content</h1>
            <p>This is the main content area that should be captured by the selector.</p>
          </main>
          <footer>Footer Content</footer>
        </body>
      </html>
    `, 'text/html');

    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { 
        url: server.PREFIX,
        expectation: {
          includeSnapshot: false
        }
      }
    });

    // Take a snapshot with selector
    const result = await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: 'main',
            maxLength: 500
          }
        }
      }
    });

    // Verify partial snapshot was captured
    const content = result.content[0].text;
    
    // Should contain only main content in snapshot
    expect(content).toContain('Page Snapshot:');
    expect(content).toContain('Main Content');
    
    // Should not contain header or footer content in the snapshot
    expect(content).not.toContain('Header Content');
    expect(content).not.toContain('Footer Content');
  });

  test('should fall back to full snapshot when selector not found', async ({ client, server }) => {
    server.setContent('/', `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <div>Some content</div>
        </body>
      </html>
    `, 'text/html');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { 
        url: server.PREFIX,
        expectation: {
          includeSnapshot: false
        }
      }
    });

    const result = await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: '.non-existent-selector'
          }
        }
      }
    });

    // Should fall back to full snapshot
    const content = result.content[0].text;
    expect(content).not.toMatch(/element \[\.non-existent-selector\]:/);
    expect(content).toContain('div'); // Full snapshot contains page structure
  });

  test('should apply maxLength truncation at word boundary', async ({ client, server }) => {
    server.setContent('/long-content', `
      <html>
        <body>
          <main>
            <p>This is a very long paragraph that contains multiple sentences. 
            Each sentence is designed to test the word boundary truncation feature. 
            The truncation should happen at a word boundary, not in the middle of a word. 
            This ensures that the output is readable and professional.</p>
          </main>
        </body>
      </html>
    `, 'text/html');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { 
        url: server.PREFIX + 'long-content',
        expectation: {
          includeSnapshot: false
        }
      }
    });

    const result = await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: 'main',
            maxLength: 100
          }
        }
      }
    });

    const content = result.content[0].text;
    
    // Should contain main content
    expect(content).toContain('main');
    expect(content).toContain('long paragraph');
    
    // Extract the actual snapshot content
    const lines = content.split('\n');
    const yamlStartIdx = lines.findIndex(l => l.includes('```yaml'));
    const yamlEndIdx = lines.findIndex((l, i) => i > yamlStartIdx && l.includes('```'));
    
    if (yamlStartIdx !== -1 && yamlEndIdx !== -1) {
      const snapshotContent = lines.slice(yamlStartIdx + 1, yamlEndIdx).join('\n');
      
      // Should be truncated to maxLength
      expect(snapshotContent.length).toBeLessThanOrEqual(100);
      
      // Should end at word boundary
      const lastChar = snapshotContent.trim().slice(-1);
      expect(lastChar).not.toBe('.');  // Not mid-sentence
    }
  });

  test('should work with navigate tool expectation', async ({ client, server }) => {
    server.setContent('/', `
      <html>
        <head><title>Navigate Test</title></head>
        <body>
          <h1>Test Page</h1>
          <p>Body content here</p>
        </body>
      </html>
    `, 'text/html');

    // Test that navigate tool passes expectation with snapshot options
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: 'body',
            maxLength: 300
          }
        }
      }
    });

    const content = result.content[0].text;
    
    // Should have used partial snapshot
    expect(content).toContain('Page Snapshot:');
    
    // Verify selector was applied - body content only
    expect(content).toContain('Test Page');
    expect(content).toContain('Body content here');
    
    // The snapshot should be limited due to maxLength
    const lines = content.split('\n');
    const yamlStartIdx = lines.findIndex(l => l.includes('```yaml'));
    const yamlEndIdx = lines.findIndex((l, i) => i > yamlStartIdx && l.includes('```'));
    
    if (yamlStartIdx !== -1 && yamlEndIdx !== -1) {
      const snapshotContent = lines.slice(yamlStartIdx + 1, yamlEndIdx).join('\n');
      expect(snapshotContent.length).toBeLessThanOrEqual(300);
    }
  });
});