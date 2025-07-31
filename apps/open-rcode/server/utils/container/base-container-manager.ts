export interface BaseContainerOptions {
  image: string
  name?: string
  workdir?: string
  environment?: Record<string, string>
  volumes?: string[] // Maintenu pour compatibilité Docker
  ports?: Record<string, string>
  command?: string[]
  autoRemove?: boolean
  restartPolicy?: string
}

export interface BaseExecuteOptions {
  containerId: string
  command: string[]
  workdir?: string
  environment?: Record<string, string>
  user?: string
}

export interface BaseContainerInfo {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: any[]
  created: Date
  labels?: Record<string, string>
}

export interface ExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface BaseConnectionOptions {
  [key: string]: any
}

export abstract class BaseContainerManager {
  protected connectionOptions: BaseConnectionOptions

  constructor(options?: BaseConnectionOptions) {
    this.connectionOptions = options || {}
  }

  abstract isAvailable(): Promise<boolean>
  abstract generateContainerName(prefix?: string): string
  abstract createContainer(options: BaseContainerOptions): Promise<string>
  abstract executeInContainer(options: BaseExecuteOptions): Promise<ExecuteResult>
  abstract stopContainer(containerId: string, timeout?: number): Promise<void>
  abstract removeContainer(containerId: string, force?: boolean): Promise<void>
  abstract getContainerInfo(containerId: string): Promise<BaseContainerInfo | null>
  abstract listContainers(all?: boolean): Promise<BaseContainerInfo[]>
  abstract getContainerLogs(containerId: string, tail?: number): Promise<string>
  abstract copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void>
  abstract restartContainer(containerId: string, timeout?: number): Promise<void>
  abstract cleanupContainers(): Promise<number>

  getConnectionInfo(): BaseConnectionOptions {
    return this.connectionOptions
  }
}