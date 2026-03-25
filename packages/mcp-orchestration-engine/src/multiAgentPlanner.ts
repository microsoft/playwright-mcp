import { ExecutionGraph, GraphNode } from './graph';
import { TaskInput } from './types';

export function buildExecutionGraph(task: TaskInput): ExecutionGraph {
  const nodes: GraphNode[] = [];

  if (task.type === 'research-code') {
    nodes.push(
      {
        id: 'research',
        type: 'step',
        description: 'Perform research',
        taskType: 'research',
        dependencies: [],
        payload: task.payload,
        status: 'pending'
      },
      {
        id: 'summarize',
        type: 'step',
        description: 'Summarize research',
        taskType: 'summarize',
        dependencies: ['research'],
        status: 'pending'
      },
      {
        id: 'code',
        type: 'step',
        description: 'Generate code',
        taskType: 'code',
        dependencies: ['summarize'],
        status: 'pending'
      }
    );
  } else {
    nodes.push({
      id: 'single',
      type: 'step',
      description: 'Single step execution',
      taskType: task.type,
      dependencies: [],
      payload: task.payload,
      status: 'pending'
    });
  }

  return {
    taskId: task.id,
    nodes
  };
}
