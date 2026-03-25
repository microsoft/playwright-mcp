import { WorkerDefinition } from './types';

const workers: WorkerDefinition[] = [];

export function registerWorker(worker: WorkerDefinition) {
  workers.push(worker);
}

export function getWorkers(): WorkerDefinition[] {
  return workers;
}
