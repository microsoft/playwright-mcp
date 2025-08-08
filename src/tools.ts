import type { FullConfig } from './config.js';
import { batchExecuteTool } from './tools/batchExecute.js';
import common from './tools/common.js';
import console from './tools/console.js';
import { browserDiagnose } from './tools/diagnose.js';
import dialogs from './tools/dialogs.js';
import evaluate from './tools/evaluate.js';
import files from './tools/files.js';
import { browserFindElements } from './tools/findElements.js';
import install from './tools/install.js';
import keyboard from './tools/keyboard.js';
import mouse from './tools/mouse.js';
import navigate from './tools/navigate.js';
import network from './tools/network.js';
import pdf from './tools/pdf.js';
import screenshot from './tools/screenshot.js';
import snapshot from './tools/snapshot.js';
import tabs from './tools/tabs.js';
import type { Tool } from './tools/tool.js';
import wait from './tools/wait.js';
export const allTools: Tool<any>[] = [
  ...common,
  ...console,
  ...dialogs,
  ...evaluate,
  ...files,
  ...install,
  ...keyboard,
  ...navigate,
  ...network,
  ...mouse,
  ...pdf,
  ...screenshot,
  ...snapshot,
  ...tabs,
  ...wait,
  batchExecuteTool,
  browserFindElements,
  browserDiagnose,
];
export function filteredTools(config: FullConfig): Tool<any>[] {
  return allTools.filter(
    (tool) =>
      tool.capability.startsWith('core') ||
      config.capabilities?.includes(tool.capability)
  );
}
