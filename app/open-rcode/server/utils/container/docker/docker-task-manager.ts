import type { 
  TaskOrchestrator, 
  TaskContainerOptions, 
  ContainerSetupResult,
  ContainerInfo
} from '../interfaces/task-orchestrator.interface';
import { DockerContainerManager } from './docker-container-manager';
import { ContainerSetup } from '../../container-setup';
import { ClaudeExecutor } from '../../claude-executor';
import { ContainerCleanup } from '../../container-cleanup';
import { DockerManager } from '../../docker';

export class DockerTaskManager implements TaskOrchestrator {
  private dockerManager: DockerContainerManager;
  private containerSetup: ContainerSetup;
  private claudeExecutor: ClaudeExecutor;
  private containerCleanup: ContainerCleanup;
  private docker: DockerManager;

  constructor(dockerOptions?: any) {
    this.docker = new DockerManager(dockerOptions);
    this.dockerManager = new DockerContainerManager(dockerOptions);
    this.containerSetup = new ContainerSetup(this.docker);
    this.claudeExecutor = new ClaudeExecutor(this.docker);
    this.containerCleanup = new ContainerCleanup(this.docker);
  }

  async createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    const result = await this.containerSetup.setupContainer(options);
    return {
      ...result,
      provider: 'docker'
    };
  }

  async executeCommand(containerId: string, command: string, workingDir?: string): Promise<string> {
    const result = await this.dockerManager.executeInContainer({
      containerId,
      command: ['/bin/bash', '-c', command],
      workingDir
    });

    if (result.exitCode !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
    }

    return result.stdout;
  }

  async executeAIPrompt(containerId: string, prompt: string, provider?: string): Promise<string> {
    return this.claudeExecutor.executeCommand(containerId, prompt);
  }

  async cleanupTaskContainer(taskId: string): Promise<void> {
    return this.containerCleanup.cleanupTaskContainer(taskId);
  }

  async getTaskContainerStatus(taskId: string): Promise<ContainerInfo | null> {
    const containers = await this.dockerManager.listContainers({
      label: [`task-id=${taskId}`]
    });

    return containers.length > 0 ? containers[0] : null;
  }
}