type Task = {
  id: string;
  type: string;
  payload: any;
  priority?: "low" | "medium" | "high";
};

type Worker = {
  name: string;
  capabilities: string[];
  execute: (task: Task) => Promise<any>;
};

class Orchestrator {
  private workers: Worker[] = [];

  registerWorker(worker: Worker) {
    this.workers.push(worker);
  }

  async routeTask(task: Task) {
    const candidates = this.workers.filter(w =>
      w.capabilities.includes(task.type)
    );

    if (!candidates.length) {
      throw new Error(`No worker found for task type: ${task.type}`);
    }

    const selected = this.selectWorker(task, candidates);
    return selected.execute(task);
  }

  private selectWorker(task: Task, workers: Worker[]): Worker {
    if (task.priority === "high") return workers[0];
    return workers[Math.floor(Math.random() * workers.length)];
  }
}

// Example workers
const orchestrator = new Orchestrator();

orchestrator.registerWorker({
  name: "research-agent",
  capabilities: ["research"],
  execute: async (task) => {
    return {
      agent: "perplexity",
      result: `Research completed for: ${task.payload.query}`
    };
  }
});

orchestrator.registerWorker({
  name: "code-agent",
  capabilities: ["code"],
  execute: async (task) => {
    return {
      agent: "copilot",
      result: `Code generated for: ${task.payload.spec}`
    };
  }
});

export async function handleTask(input: Task) {
  return orchestrator.routeTask(input);
}
