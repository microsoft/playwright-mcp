/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, test } from './fixtures.js';
import {
  clickButtonAndExpectModal,
  DIALOG_EXPECTATIONS,
  executeDialogTest,
  HTML_TEMPLATES,
  handleDialogAndExpectState,
  setupDialogTest,
} from './test-helpers.js';

test('alert dialog', async ({ client, server }) => {
  await executeDialogTest(
    client,
    server,
    {
      dialogType: 'alert',
      message: 'Alert',
      accept: true,
    },
    {
      htmlContent: HTML_TEMPLATES.ALERT_BUTTON(),
    }
  );
});

test('two alert dialogs', async ({ client, server }) => {
  await setupDialogTest(client, server, HTML_TEMPLATES.DOUBLE_ALERT_BUTTON());

  await clickButtonAndExpectModal(
    client,
    'Button',
    DIALOG_EXPECTATIONS.ALERT_MODAL('Alert 1'),
    DIALOG_EXPECTATIONS.BUTTON_CLICKED('Button').code
  );

  await handleDialogAndExpectState(
    client,
    true,
    undefined,
    DIALOG_EXPECTATIONS.ALERT_MODAL('Alert 2')
  );

  const result2 = await handleDialogAndExpectState(
    client,
    true,
    undefined,
    DIALOG_EXPECTATIONS.NO_MODAL
  );

  expect(result2).not.toHaveResponse({
    modalState: DIALOG_EXPECTATIONS.ALERT_MODAL('Alert 2'),
  });
});

test('confirm dialog (true)', async ({ client, server }) => {
  await executeDialogTest(
    client,
    server,
    {
      dialogType: 'confirm',
      message: 'Confirm',
      accept: true,
      expectedResult: 'true',
    },
    {
      htmlContent: HTML_TEMPLATES.CONFIRM_BUTTON(),
    }
  );
});

test('confirm dialog (false)', async ({ client, server }) => {
  await executeDialogTest(
    client,
    server,
    {
      dialogType: 'confirm',
      message: 'Confirm',
      accept: false,
      expectedResult: 'false',
    },
    {
      htmlContent: HTML_TEMPLATES.CONFIRM_BUTTON(),
    }
  );
});

test('prompt dialog', async ({ client, server }) => {
  await setupDialogTest(client, server, HTML_TEMPLATES.PROMPT_BUTTON());

  await clickButtonAndExpectModal(
    client,
    'Button',
    DIALOG_EXPECTATIONS.PROMPT_MODAL('Prompt')
  );

  await handleDialogAndExpectState(
    client,
    true,
    DIALOG_EXPECTATIONS.RESULT_CONTENT('Answer'),
    DIALOG_EXPECTATIONS.NO_MODAL,
    'Answer'
  );
});

test('alert dialog w/ race', async ({ client, server }) => {
  await setupDialogTest(client, server, HTML_TEMPLATES.DELAYED_ALERT_BUTTON());

  await clickButtonAndExpectModal(
    client,
    'Button',
    DIALOG_EXPECTATIONS.ALERT_MODAL('Alert'),
    DIALOG_EXPECTATIONS.BUTTON_CLICKED('Button').code
  );

  await handleDialogAndExpectState(
    client,
    true,
    expect.stringContaining(`- Page URL: ${server.PREFIX}
- Page Title: 
- Page Snapshot:
\`\`\`yaml
- button "Button"`),
    DIALOG_EXPECTATIONS.NO_MODAL
  );
});
