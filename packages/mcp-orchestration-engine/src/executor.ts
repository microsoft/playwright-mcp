import { ExecutionGraph, getReadyNodes, updateNodeStatus, graphCompleted } from './graph';
import { getWorkers } from './registry';
import { routeTask } from './router';
import { TaskInput } from './types';

export async function executeGraph(graph: ExecutionGraph, originalTask: TaskInput) {
  let currentGraph = graph;

  while (!graphCompleted(currentGraph)) {
    const readyNodes = getReadyNodes(currentGraph);

    if (!readyNodes.length) {
      throw new Error('Deadlock detected in execution graph');
    }

    await Promise.all(
      readyNodes.map(async node => {
        try {
          currentGraph = updateNodeStatus(currentGraph, node.id, 'running');

          const routing = routeTask(
            {
              id: originalTask.id,
              type: node.taskType,
              payload: node.payload || {}
            },
            getWorkers()
          );

          const worker = getWorkers().find(w => w.name === routing.worker);
          if (!worker) throw new Error('Worker not found');

          const result = await worker.execute({
            id: originalTask.id,
            type: node.taskType,
            payload: node.payload || {}
          });

          currentGraph = updateNodeStatus(currentGraph, node.id, 'completed', {
            result,
            assignedWorker: worker.name
          });
        } catch (error: any) {
          currentGraph = updateNodeStatus(currentGraph, node.id, 'failed', {
            error: error.message
          });
          throw error;
        }
      })
    );
  }

  return currentGraph;
}
