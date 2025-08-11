/**
 * browser_diagnose Tool Tests
 */

import { test } from './fixtures.js';
import {
  DIAGNOSE_HTML_TEMPLATES,
  expectDiagnoseContent,
  setupDiagnoseTest,
  setupDiagnoseWithElementSearch,
} from './test-helpers.js';

test('browser_diagnose - basic page analysis', async ({ client, server }) => {
  const result = await setupDiagnoseTest(
    client,
    server,
    DIAGNOSE_HTML_TEMPLATES.BASIC_WITH_IFRAME
  );

  expectDiagnoseContent(result, [
    'iframes detected:',
    'Total visible elements:',
  ]);
});

test('browser_diagnose - with element search', async ({ client, server }) => {
  const result = await setupDiagnoseWithElementSearch(
    client,
    server,
    DIAGNOSE_HTML_TEMPLATES.BUTTONS_WITH_DATA_ACTION,
    { text: 'Submit', role: 'button' }
  );

  expectDiagnoseContent(result, ['Element Search Results', 'Submit']);
});

test('browser_diagnose - performance analysis', async ({ client, server }) => {
  const result = await setupDiagnoseTest(
    client,
    server,
    DIAGNOSE_HTML_TEMPLATES.SIMPLE_BUTTON_DIV,
    { includePerformanceMetrics: true }
  );

  expectDiagnoseContent(result, ['Performance Metrics']);
});

test('browser_diagnose - comprehensive report', async ({ client, server }) => {
  const result = await setupDiagnoseTest(
    client,
    server,
    DIAGNOSE_HTML_TEMPLATES.COMPREHENSIVE_FORM,
    {
      searchForElements: { role: 'textbox' },
      includePerformanceMetrics: true,
      includeAccessibilityInfo: true,
    }
  );

  expectDiagnoseContent(result, [
    'Element Search Results',
    'Performance Metrics',
    'Accessibility Information',
  ]);
});

test('browser_diagnose - with troubleshooting suggestions', async ({
  client,
  server,
}) => {
  const result = await setupDiagnoseTest(
    client,
    server,
    DIAGNOSE_HTML_TEMPLATES.IFRAME_WITH_HIDDEN_BUTTON,
    { includeTroubleshootingSuggestions: true }
  );

  expectDiagnoseContent(result, ['Troubleshooting Suggestions', 'iframe']);
});
