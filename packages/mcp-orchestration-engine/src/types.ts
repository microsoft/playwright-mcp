export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskInput = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority?: TaskPriority;
  metadata?: Record<string, unknown>;
};

export type ExecutionStatus = 'queued' | 'planned' | 'running' | 'completed' | 'failed';

export type ExecutionRecord = {
  taskId: string;
  status: ExecutionStatus;
  selectedWorker?: string;
  plan?: string[];
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkerCapability = {
  taskType: string;
  description: string;
};

export type WorkerDefinition = {
  name: string;
  description: string;
  capabilities: WorkerCapability[];
  execute: (task: TaskInput) => Promise<unknown>;
};

export type RouteResult = {
  worker: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
};
