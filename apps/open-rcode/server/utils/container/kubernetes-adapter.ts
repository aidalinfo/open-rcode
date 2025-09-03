import { KubernetesManager } from './kubernetes/kubernetes-manager'
import type { BaseContainerOptions, BaseExecuteOptions, BaseContainerInfo, ExecuteResult, BaseConnectionOptions } from './base-container-manager'
import { BaseContainerManager } from './base-container-manager'

export class KubernetesAdapter extends BaseContainerManager {
  private kubernetesManager: KubernetesManager

  constructor(options?: BaseConnectionOptions) {
    super(options)
    this.kubernetesManager = new KubernetesManager(options)
  }

  async isAvailable(): Promise<boolean> {
    return this.kubernetesManager.isKubernetesAvailable()
  }

  generateContainerName(prefix: string = 'openrcode'): string {
    return KubernetesManager.generatePodName(prefix)
  }

  async createContainer(options: BaseContainerOptions): Promise<string> {
    const kubernetesOptions = {
      image: options.image, // L'image sera forcée à ghcr.io/aidalinfo/open-rcoder-worker:latest dans KubernetesManager
      name: options.name,
      workdir: options.workdir,
      environment: options.environment,
      ports: options.ports,
      command: options.command,
      restartPolicy: this.mapRestartPolicy(options.restartPolicy),
      namespace: this.kubernetesManager.getConnectionInfo().namespace
    }

    return this.kubernetesManager.createPod(kubernetesOptions)
  }

  private mapRestartPolicy(dockerPolicy?: string): 'Never' | 'OnFailure' | 'Always' {
    switch (dockerPolicy) {
      case 'always':
        return 'Always'
      case 'on-failure':
        return 'OnFailure'
      case 'no':
      case 'unless-stopped':
      default:
        return 'Never'
    }
  }

  async executeInContainer(options: BaseExecuteOptions): Promise<ExecuteResult> {
    const kubernetesOptions = {
      podName: options.containerId, // Dans K8s, on utilise le nom du pod
      command: options.command,
      workdir: options.workdir,
      environment: options.environment,
      namespace: this.kubernetesManager.getConnectionInfo().namespace
    }

    return this.kubernetesManager.executeInPod(kubernetesOptions)
  }

  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    // Dans Kubernetes, arrêter un pod signifie le supprimer
    // On ne peut pas juste l'arrêter comme avec Docker
    await this.kubernetesManager.deletePod(containerId)
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    await this.kubernetesManager.deletePod(containerId)
  }

  async getContainerInfo(containerId: string): Promise<BaseContainerInfo | null> {
    const podInfo = await this.kubernetesManager.getPodInfo(containerId)
    if (!podInfo) return null

    return {
      id: podInfo.name,
      name: podInfo.name,
      image: podInfo.image,
      status: podInfo.status,
      state: podInfo.phase,
      ports: podInfo.containers.map(c => ({
        name: c.name,
        ready: c.ready,
        restartCount: c.restartCount
      })),
      created: podInfo.created,
      labels: podInfo.labels
    }
  }

  async listContainers(all: boolean = false): Promise<BaseContainerInfo[]> {
    const pods = await this.kubernetesManager.listPods()

    return pods
      .filter(pod => all || pod.phase === 'Running')
      .map(pod => ({
        id: pod.name,
        name: pod.name,
        image: pod.image,
        status: pod.status,
        state: pod.phase,
        ports: pod.containers.map(c => ({
          name: c.name,
          ready: c.ready,
          restartCount: c.restartCount
        })),
        created: pod.created,
        labels: pod.labels
      }))
  }

  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    return this.kubernetesManager.getPodLogs(containerId, undefined, tail)
  }

  async copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    throw new Error('copyToContainer not supported in Kubernetes mode - use git clone commands instead')
  }

  async restartContainer(containerId: string, timeout: number = 10): Promise<void> {
    return this.kubernetesManager.restartPod(containerId)
  }

  async cleanupContainers(): Promise<number> {
    return this.kubernetesManager.cleanupPods()
  }

  async executeInContainerWithStreaming(options: BaseExecuteOptions, onOutput?: (data: string) => void): Promise<ExecuteResult> {
    const kubernetesOptions = {
      podName: options.containerId, // Dans K8s, on utilise le nom du pod
      command: options.command,
      workdir: options.workdir,
      environment: options.environment,
      namespace: this.kubernetesManager.getConnectionInfo().namespace
    }

    return this.kubernetesManager.executeInPodWithStreaming(kubernetesOptions, onOutput)
  }

  getKubernetesInstance(): KubernetesManager {
    return this.kubernetesManager
  }
}
