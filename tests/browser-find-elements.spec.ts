/**
 * browser_find_elements Tool Tests
 */

import { test } from './fixtures.js';
import {
  expectFindElementsNoMatches,
  expectFindElementsSuccess,
  FIND_ELEMENTS_HTML_TEMPLATES,
  setupFindElementsTest,
} from './test-helpers.js';

test('browser_find_elements - find by multiple criteria', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.MULTI_CRITERIA_ELEMENTS,
    {
      text: 'Submit',
      role: 'button',
    },
    { maxResults: 5 }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - find by tag name', async ({ client, server }) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.FORM_WITH_INPUTS,
    { tagName: 'input' },
    { maxResults: 10 }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - find by attributes', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.BUTTONS_WITH_DATA_ACTION,
    {
      attributes: {
        'data-action': 'save',
      },
    }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - handle no matches', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.NO_BUTTONS_CONTENT,
    { role: 'button' }
  );

  expectFindElementsNoMatches(result);
});

test('browser_find_elements - limit results', async ({ client, server }) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.MULTIPLE_BUTTONS(10),
    { tagName: 'button' },
    { maxResults: 3 }
  );

  expectFindElementsSuccess(result);
});
