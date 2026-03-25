import { planTask } from './planner';
import { routeTask } from './router';
import { registerWorker, getWorkers } from './registry';
import { createRecord, updateRecord } from './memory';
import { TaskInput } from './types';

// Example worker
registerWorker({
  name: 'default-research',
  description: 'Basic research worker',
  capabilities: [{ taskType: 'research', description: 'Handles research tasks' }],
  execute: async (task) => {
    return { result: `Research done: ${task.payload?.query}` };
  }
});

export async function route_task(input: TaskInput) {
  const record = createRecord(input.id);

  try {
    const plan = planTask(input);
    updateRecord(input.id, { status: 'planned', plan });

    const routing = routeTask(input, getWorkers());
    updateRecord(input.id, { selectedWorker: routing.worker });

    const worker = getWorkers().find(w => w.name === routing.worker);
    if (!worker) throw new Error('Worker not found');

    updateRecord(input.id, { status: 'running' });
    const result = await worker.execute(input);

    updateRecord(input.id, { status: 'completed', result });

    return {
      success: true,
      plan,
      routing,
      result
    };
  } catch (error: any) {
    updateRecord(input.id, { status: 'failed', error: error.message });

    return {
      success: false,
      error: error.message
    };
  }
}
