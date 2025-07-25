import { DockerAdapter } from './docker-adapter'
import { KubernetesAdapter } from './kubernetes-adapter'
import { BaseContainerManager, BaseConnectionOptions } from './base-container-manager'

export type ContainerMode = 'docker' | 'kubernetes'

export interface ContainerManagerFactoryOptions {
  mode?: ContainerMode
  connectionOptions?: BaseConnectionOptions
}

export class ContainerManagerFactory {
  private static defaultMode: ContainerMode = 'docker'

  static setDefaultMode(mode: ContainerMode): void {
    ContainerManagerFactory.defaultMode = mode
  }

  static getDefaultMode(): ContainerMode {
    const envMode = process.env.CONTAINER_MODE?.toLowerCase()
    if (envMode === 'kubernetes' || envMode === 'k8s') {
      return 'kubernetes'
    }
    return ContainerManagerFactory.defaultMode
  }

  static create(options?: ContainerManagerFactoryOptions): BaseContainerManager {
    const mode = options?.mode || ContainerManagerFactory.getDefaultMode()
    const connectionOptions = options?.connectionOptions

    console.log(`🔧 Container Manager: Using ${mode.toUpperCase()} mode`)

    switch (mode) {
      case 'kubernetes':
        console.log('☸️ Initializing Kubernetes container manager')
        return new KubernetesAdapter(connectionOptions)
      case 'docker':
      default:
        console.log('🐳 Initializing Docker container manager')
        return new DockerAdapter(connectionOptions)
    }
  }

  static createDocker(connectionOptions?: BaseConnectionOptions): DockerAdapter {
    return new DockerAdapter(connectionOptions)
  }

  static createKubernetes(connectionOptions?: BaseConnectionOptions): KubernetesAdapter {
    return new KubernetesAdapter(connectionOptions)
  }

  static async createWithAutoDetection(options?: ContainerManagerFactoryOptions): Promise<BaseContainerManager> {
    const connectionOptions = options?.connectionOptions

    // Essayer Kubernetes en premier si le mode n'est pas spécifié
    if (!options?.mode) {
      const k8sManager = new KubernetesAdapter(connectionOptions)
      if (await k8sManager.isAvailable()) {
        console.log('Auto-detected Kubernetes environment')
        return k8sManager
      }

      const dockerManager = new DockerAdapter(connectionOptions)
      if (await dockerManager.isAvailable()) {
        console.log('Auto-detected Docker environment')
        return dockerManager
      }

      throw new Error('Neither Docker nor Kubernetes are available')
    }

    return ContainerManagerFactory.create(options)
  }
}

// Fonction helper pour créer un gestionnaire avec la configuration par défaut
export function createContainerManager(options?: ContainerManagerFactoryOptions): BaseContainerManager {
  return ContainerManagerFactory.create(options)
}

// Fonction helper pour créer un gestionnaire avec auto-détection
export async function createContainerManagerWithAutoDetection(options?: ContainerManagerFactoryOptions): Promise<BaseContainerManager> {
  return ContainerManagerFactory.createWithAutoDetection(options)
}