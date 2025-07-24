export interface ContainerOptions {
  image: string;
  name: string;
  env?: Record<string, string>;
  volumes?: Array<{ host: string; container: string }>;
  workingDir?: string;
  labels?: Record<string, string>;
  memory?: string;
  cpus?: number;
}

export interface ExecuteOptions {
  containerId: string;
  command: string[];
  env?: Record<string, string>;
  workingDir?: string;
  user?: string;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  state: 'running' | 'stopped' | 'removing' | 'unknown';
  labels?: Record<string, string>;
  createdAt?: Date;
}

export interface ContainerManager {
  createContainer(options: ContainerOptions): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  executeInContainer(options: ExecuteOptions): Promise<ExecuteResult>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  getContainerInfo(containerId: string): Promise<ContainerInfo | null>;
  listContainers(filters?: { label?: string[] }): Promise<ContainerInfo[]>;
  getContainerLogs(containerId: string, options?: { tail?: number }): Promise<string>;
  waitForContainer(containerId: string): Promise<number>;
}