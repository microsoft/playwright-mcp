import { WorkerDefinition, TaskInput, RouteResult } from './types';

export function routeTask(task: TaskInput, workers: WorkerDefinition[]): RouteResult {
  const candidates = workers.filter(w =>
    w.capabilities.some(c => c.taskType === task.type)
  );

  if (!candidates.length) {
    throw new Error(`No worker available for task type: ${task.type}`);
  }

  // naive scoring
  const selected = candidates[0];

  return {
    worker: selected.name,
    confidence: 'medium',
    reasons: ['Matched capability']
  };
}
