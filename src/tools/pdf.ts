import { z } from 'zod';
import { formatObject } from '../javascript.js';
import { defineTabTool } from './tool.js';

const pdfSchema = z.object({
  filename: z
    .string()
    .optional()
    .describe(
      'File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.'
    ),
});
const pdf = defineTabTool({
  capability: 'pdf',
  schema: {
    name: 'browser_pdf_save',
    title: 'Save as PDF',
    description: 'Save page as PDF',
    inputSchema: pdfSchema,
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const fileName = await tab.context.outputFile(
      params.filename ?? `page-${new Date().toISOString()}.pdf`
    );
    response.addCode(`await page.pdf(${formatObject({ path: fileName })});`);
    response.addResult(`Saved page as ${fileName}`);
    await tab.page.pdf({ path: fileName });
  },
});
export default [pdf];
