export interface TaskContainerOptions {
  taskId: string;
  userId: string;
  environmentId: string;
  repoUrl?: string;
  branchName?: string;
  aiProvider?: 'claude' | 'anthropic' | 'gemini';
  customEnv?: Record<string, string>;
  memory?: string;
  cpus?: number;
}

export interface ContainerSetupResult {
  containerId: string;
  containerName: string;
  workspaceDir: string;
  claudeCommand?: string;
  geminiCommand?: string;
  provider?: 'docker' | 'kubernetes';
}

export interface TaskOrchestrator {
  createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult>;
  executeCommand(containerId: string, command: string, workingDir?: string): Promise<string>;
  executeAIPrompt(containerId: string, prompt: string, provider?: string): Promise<string>;
  cleanupTaskContainer(taskId: string): Promise<void>;
  getTaskContainerStatus(taskId: string): Promise<ContainerInfo | null>;
}