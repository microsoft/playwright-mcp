import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTabTool } from './tool.js';

const uploadFile = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_file_upload',
    title: 'Upload files',
    description: `Upload one or multiple files to file input.paths:["/path/file1.jpg","/path/file2.pdf"] for multiple files.expectation:{includeSnapshot:true,snapshotOptions:{selector:"form"}} to verify upload.Must be triggered after file input interaction.USE batch_execute for click→upload workflows.`,
    inputSchema: z.object({
      paths: z
        .array(z.string())
        .describe(
          'The absolute paths to the files to upload. Can be a single file or multiple files.'
        ),
      expectation: expectationSchema,
    }),
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    const modalState = tab
      .modalStates()
      .find((state) => state.type === 'fileChooser');
    if (!modalState) {
      throw new Error('No file chooser visible');
    }
    response.addCode(
      `await fileChooser.setFiles(${JSON.stringify(params.paths)})`
    );
    tab.clearModalState(modalState);
    await tab.waitForCompletion(async () => {
      await modalState.fileChooser.setFiles(params.paths);
    });
  },
  clearsModalState: 'fileChooser',
});
export default [uploadFile];
