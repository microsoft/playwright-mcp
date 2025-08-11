import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTabTool } from './tool.js';

const handleDialog = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_handle_dialog',
    title: 'Handle a dialog',
    description: `Handle a dialog(alert,confirm,prompt).accept:true to accept,false to dismiss.promptText:"answer" for prompt dialogs.expectation:{includeSnapshot:true} to see page after dialog handling.USE batch_execute if dialog appears during workflow.`,
    inputSchema: z.object({
      accept: z.boolean().describe('Whether to accept the dialog.'),
      promptText: z
        .string()
        .optional()
        .describe('The text of the prompt in case of a prompt dialog.'),
      expectation: expectationSchema,
    }),
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    const dialogState = tab
      .modalStates()
      .find((state) => state.type === 'dialog');
    if (!dialogState) {
      throw new Error('No dialog visible');
    }
    tab.clearModalState(dialogState);
    await tab.waitForCompletion(async () => {
      if (params.accept) {
        await dialogState.dialog.accept(params.promptText);
      } else {
        await dialogState.dialog.dismiss();
      }
    });
  },
  clearsModalState: 'dialog',
});
export default [handleDialog];
