export type GraphNodeStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed';

export type GraphNode = {
  id: string;
  type: string;
  description: string;
  taskType: string;
  dependencies: string[];
  payload?: Record<string, unknown>;
  assignedWorker?: string;
  status: GraphNodeStatus;
  result?: unknown;
  error?: string;
};

export type ExecutionGraph = {
  taskId: string;
  nodes: GraphNode[];
};

export function getReadyNodes(graph: ExecutionGraph): GraphNode[] {
  const completed = new Set(
    graph.nodes.filter(node => node.status === 'completed').map(node => node.id)
  );

  return graph.nodes.filter(node => {
    if (node.status !== 'pending' && node.status !== 'ready') return false;
    return node.dependencies.every(dep => completed.has(dep));
  });
}

export function updateNodeStatus(
  graph: ExecutionGraph,
  nodeId: string,
  status: GraphNodeStatus,
  patch?: Partial<GraphNode>
): ExecutionGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(node =>
      node.id === nodeId ? { ...node, ...patch, status } : node
    )
  };
}

export function graphCompleted(graph: ExecutionGraph): boolean {
  return graph.nodes.every(node => node.status === 'completed');
}
