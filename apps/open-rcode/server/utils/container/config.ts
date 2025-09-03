/**
 * Configuration des gestionnaires de conteneurs
 */

export interface ContainerConfig {
  mode: 'docker' | 'kubernetes'
  namespace?: string
  kubeconfig?: string
  context?: string
  dockerHost?: string
  dockerPort?: number
}

/**
 * Récupère la configuration des conteneurs à partir des variables d'environnement
 */
export function getContainerConfig(): ContainerConfig {
  const mode = getContainerMode()

  const config: ContainerConfig = {
    mode
  }

  if (mode === 'kubernetes') {
    config.namespace = process.env.KUBERNETES_NAMESPACE || 'default'
    config.kubeconfig = process.env.KUBECONFIG
    config.context = process.env.KUBERNETES_CONTEXT
  } else {
    config.dockerHost = process.env.DOCKER_HOST
    config.dockerPort = process.env.DOCKER_PORT ? parseInt(process.env.DOCKER_PORT) : undefined
  }

  return config
}

/**
 * Détermine le mode de conteneur à partir des variables d'environnement
 */
export function getContainerMode(): 'docker' | 'kubernetes' {
  const mode = process.env.CONTAINER_MODE?.toLowerCase()

  if (mode === 'kubernetes' || mode === 'k8s') {
    return 'kubernetes'
  }

  return 'docker'
}

/**
 * Vérifie si le mode Kubernetes est activé
 */
export function isKubernetesMode(): boolean {
  return getContainerMode() === 'kubernetes'
}

/**
 * Vérifie si le mode Docker est activé
 */
export function isDockerMode(): boolean {
  return getContainerMode() === 'docker'
}

/**
 * Variables d'environnement supportées pour la configuration des conteneurs
 */
export const SUPPORTED_ENV_VARS = {
  // Mode de conteneur
  CONTAINER_MODE: 'Mode de conteneur: "docker" ou "kubernetes"',

  // Configuration Kubernetes
  KUBERNETES_NAMESPACE: 'Namespace Kubernetes par défaut (défaut: "default")',
  KUBECONFIG: 'Chemin vers le fichier kubeconfig',
  KUBERNETES_CONTEXT: 'Contexte Kubernetes à utiliser',

  // Configuration Docker
  DOCKER_HOST: 'Host Docker (ex: tcp://localhost:2376)',
  DOCKER_PORT: 'Port Docker (défaut: 2376 pour HTTPS, 2375 pour HTTP)',
  DOCKER_TLS_VERIFY: 'Vérification TLS pour Docker (1 pour activer)',
  DOCKER_CERT_PATH: 'Chemin vers les certificats Docker TLS'
} as const
