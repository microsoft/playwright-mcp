import { TaskInput } from './types';

export function planTask(task: TaskInput): string[] {
  // simple linear plan
  return [
    `validate:${task.type}`,
    `route:${task.type}`,
    `execute:${task.type}`
  ];
}
