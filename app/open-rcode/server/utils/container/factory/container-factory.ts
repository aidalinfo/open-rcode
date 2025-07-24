import type { ContainerManager } from '../interfaces/container-manager.interface';
import type { TaskOrchestrator } from '../interfaces/task-orchestrator.interface';
import { DockerContainerManager } from '../docker/docker-container-manager';
import { DockerTaskManager } from '../docker/docker-task-manager';
import { KubernetesManager } from '../kubernetes/kubernetes-manager';
import { KubernetesTaskManager } from '../kubernetes/kubernetes-task-manager';

export type ContainerProvider = 'docker' | 'kubernetes';

export class ContainerFactory {
  private static provider: ContainerProvider = 'docker';
  private static kubeconfig?: string;
  private static namespace: string = 'default';

  static {
    // Initialize from environment
    if (process.env.MODE === 'KUBERNETES') {
      this.provider = 'kubernetes';
    }
    if (process.env.KUBECONFIG) {
      this.kubeconfig = process.env.KUBECONFIG;
    }
    if (process.env.KUBERNETES_NAMESPACE) {
      this.namespace = process.env.KUBERNETES_NAMESPACE;
    }
  }

  static setProvider(provider: ContainerProvider, options?: { kubeconfig?: string; namespace?: string }) {
    this.provider = provider;
    if (options?.kubeconfig) {
      this.kubeconfig = options.kubeconfig;
    }
    if (options?.namespace) {
      this.namespace = options.namespace;
    }
  }

  static getContainerManager(): ContainerManager {
    switch (this.provider) {
      case 'kubernetes':
        return new KubernetesManager(this.kubeconfig, this.namespace);
      case 'docker':
      default:
        return new DockerContainerManager();
    }
  }

  static getTaskOrchestrator(): TaskOrchestrator {
    switch (this.provider) {
      case 'kubernetes':
        return new KubernetesTaskManager(this.kubeconfig, this.namespace);
      case 'docker':
      default:
        return new DockerTaskManager();
    }
  }

  static getCurrentProvider(): ContainerProvider {
    return this.provider;
  }

  static isKubernetes(): boolean {
    return this.provider === 'kubernetes';
  }

  static isDocker(): boolean {
    return this.provider === 'docker';
  }
}

// Export singleton instances for backward compatibility
export const containerManager = ContainerFactory.getContainerManager();
export const taskOrchestrator = ContainerFactory.getTaskOrchestrator();