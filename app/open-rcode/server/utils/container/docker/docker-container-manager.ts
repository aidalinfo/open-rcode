import type { 
  ContainerManager, 
  ContainerOptions, 
  ExecuteOptions, 
  ExecuteResult, 
  ContainerInfo 
} from '../interfaces/container-manager.interface';
import { DockerManager } from '../../docker';

export class DockerContainerManager implements ContainerManager {
  private docker: DockerManager;

  constructor(dockerOptions?: any) {
    this.docker = new DockerManager(dockerOptions);
  }

  async createContainer(options: ContainerOptions): Promise<string> {
    return this.docker.createContainer({
      Image: options.image,
      name: options.name,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
      WorkingDir: options.workingDir,
      Labels: options.labels,
      HostConfig: {
        Binds: options.volumes?.map(v => `${v.host}:${v.container}`),
        Memory: options.memory ? this.parseMemory(options.memory) : undefined,
        CpuQuota: options.cpus ? options.cpus * 100000 : undefined,
        CpuPeriod: 100000
      }
    });
  }

  async startContainer(containerId: string): Promise<void> {
    await this.docker.startContainer(containerId);
  }

  async executeInContainer(options: ExecuteOptions): Promise<ExecuteResult> {
    return this.docker.executeInContainer({
      containerId: options.containerId,
      command: options.command,
      env: options.env,
      workdir: options.workingDir,
      user: options.user
    });
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.docker.stopContainer(containerId);
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.docker.removeContainer(containerId);
  }

  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    const info = await this.docker.getContainerInfo(containerId);
    if (!info) return null;

    return {
      id: info.Id,
      name: info.Name?.startsWith('/') ? info.Name.substring(1) : info.Name,
      state: this.mapDockerState(info.State),
      labels: info.Config?.Labels,
      createdAt: info.Created ? new Date(info.Created) : undefined
    };
  }

  async listContainers(filters?: { label?: string[] }): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: filters?.label ? { label: filters.label } : undefined
    });

    return containers.map(c => ({
      id: c.Id,
      name: c.Names[0]?.startsWith('/') ? c.Names[0].substring(1) : c.Names[0],
      state: this.mapDockerState(c.State),
      labels: c.Labels,
      createdAt: new Date(c.Created * 1000)
    }));
  }

  async getContainerLogs(containerId: string, options?: { tail?: number }): Promise<string> {
    return this.docker.getContainerLogs(containerId, {
      stdout: true,
      stderr: true,
      tail: options?.tail
    });
  }

  async waitForContainer(containerId: string): Promise<number> {
    return this.docker.waitForContainer(containerId);
  }

  private mapDockerState(state: string): 'running' | 'stopped' | 'removing' | 'unknown' {
    switch (state.toLowerCase()) {
      case 'running':
        return 'running';
      case 'exited':
      case 'dead':
        return 'stopped';
      case 'removing':
        return 'removing';
      default:
        return 'unknown';
    }
  }

  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+)([KMGT]?)i?$/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'K': return value * 1024;
      case 'M': return value * 1024 * 1024;
      case 'G': return value * 1024 * 1024 * 1024;
      case 'T': return value * 1024 * 1024 * 1024 * 1024;
      default: return value;
    }
  }
}