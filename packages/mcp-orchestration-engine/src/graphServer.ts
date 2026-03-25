import { buildExecutionGraph } from './multiAgentPlanner';
import { executeGraph } from './executor';
import { TaskInput } from './types';

export async function execute_task_graph(input: TaskInput) {
  try {
    const graph = buildExecutionGraph(input);
    const resultGraph = await executeGraph(graph, input);

    return {
      success: true,
      graph: resultGraph
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
