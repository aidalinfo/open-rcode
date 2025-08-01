import { DockerManager } from '../docker'
import { BaseContainerManager, BaseContainerOptions, BaseExecuteOptions, BaseContainerInfo, ExecuteResult, BaseConnectionOptions } from './base-container-manager'

export class DockerAdapter extends BaseContainerManager {
  private dockerManager: DockerManager

  constructor(options?: BaseConnectionOptions) {
    super(options)
    this.dockerManager = new DockerManager(options)
  }

  async isAvailable(): Promise<boolean> {
    return this.dockerManager.isDockerAvailable()
  }

  generateContainerName(prefix: string = 'openrcode'): string {
    return DockerManager.generateContainerName(prefix)
  }

  async createContainer(options: BaseContainerOptions): Promise<string> {
    const dockerOptions = {
      image: options.image,
      name: options.name,
      workdir: options.workdir,
      environment: options.environment,
      volumes: options.volumes,
      ports: options.ports,
      command: options.command,
      autoRemove: options.autoRemove,
      restartPolicy: options.restartPolicy as 'no' | 'always' | 'unless-stopped' | 'on-failure'
    }
    
    return this.dockerManager.createContainer(dockerOptions)
  }

  async executeInContainer(options: BaseExecuteOptions): Promise<ExecuteResult> {
    const dockerOptions = {
      containerId: options.containerId,
      command: options.command,
      workdir: options.workdir,
      environment: options.environment,
      user: options.user
    }
    
    return this.dockerManager.executeInContainer(dockerOptions)
  }

  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    return this.dockerManager.stopContainer(containerId, timeout)
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    return this.dockerManager.removeContainer(containerId, force)
  }

  async getContainerInfo(containerId: string): Promise<BaseContainerInfo | null> {
    return this.dockerManager.getContainerInfo(containerId)
  }

  async listContainers(all: boolean = false): Promise<BaseContainerInfo[]> {
    return this.dockerManager.listContainers(all)
  }

  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    return this.dockerManager.getContainerLogs(containerId, tail)
  }

  async copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    return this.dockerManager.copyToContainer(containerId, sourcePath, destPath)
  }

  async restartContainer(containerId: string, timeout: number = 10): Promise<void> {
    return this.dockerManager.restartContainer(containerId, timeout)
  }

  async cleanupContainers(): Promise<number> {
    return this.dockerManager.cleanupContainers()
  }

  getDockerInstance() {
    return this.dockerManager.getDockerInstance()
  }

  getDockerManager() {
    return this.dockerManager
  }
}