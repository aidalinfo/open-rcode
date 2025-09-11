import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { TaskMessageModel } from '../models/TaskMessage'
import { connectToDatabase } from './database'
import { ContainerSetup } from './container-setup'
import { AIExecutor } from './ai-executor'
import { ContainerCleanup } from './container-cleanup'
import type { TaskContainerOptions, ContainerSetupResult } from './container-setup'
import { createContainerManager, ContainerManagerFactory } from './container/container-manager-factory'
import type { BaseContainerManager } from './container/base-container-manager'
import { DockerAdapter } from './container/docker-adapter'
import { v4 as uuidv4 } from 'uuid'
import { logger } from './logger'

export class TaskContainerManager {
  private containerManager: BaseContainerManager
  private containerSetup: ContainerSetup
  private aiExecutor: AIExecutor
  private containerCleanup: ContainerCleanup

  constructor(containerOptions?: any) {
    this.containerManager = createContainerManager({ connectionOptions: containerOptions })

    // Pour maintenir la compatibilité avec les classes existantes qui attendent DockerManager
    const dockerManager = this.containerManager instanceof DockerAdapter
      ? (this.containerManager as DockerAdapter).getDockerManager()
      : new DockerManager(containerOptions) // Fallback pour Kubernetes mode

    this.containerSetup = new ContainerSetup(this.containerManager, dockerManager)
    this.aiExecutor = new AIExecutor(this.containerManager)
    this.containerCleanup = new ContainerCleanup(this.containerManager)
  }

  /**
   * Obtient le gestionnaire de conteneurs (Docker ou Kubernetes)
   */
  getContainerManager(): BaseContainerManager {
    return this.containerManager
  }

  /**
   * Crée un environnement de conteneur pour une tâche avec Claude Code
   */
  async createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    await connectToDatabase()

    // Créer un message initial pour indiquer que la création du conteneur commence
    const task = await TaskModel.findById(options.taskId)
    if (task) {
      const containerType = process.env.CONTAINER_MODE?.toLowerCase() === 'kubernetes' ? 'Pod Kubernetes' : 'Conteneur Docker'
      const icon = process.env.CONTAINER_MODE?.toLowerCase() === 'kubernetes' ? '☸️' : '🐳'

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `${icon} Création du ${containerType.toLowerCase()} en cours...`
      })
    }

    const result = await this.containerSetup.setupContainer(options)

    // Mettre à jour la tâche avec l'ID du conteneur
    if (task) {
      task.dockerId = result.containerId
      const containerType = process.env.CONTAINER_MODE?.toLowerCase() === 'kubernetes' ? 'Pod Kubernetes' : 'Conteneur Docker'
      const icon = process.env.CONTAINER_MODE?.toLowerCase() === 'kubernetes' ? '☸️' : '🐳'

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `${icon} Environnement de conteneur créé avec succès.\n**${containerType}:** ${result.containerName}\n**ID:** ${result.containerId.substring(0, 12)}`
      })
      await task.save()

      // Exécuter automatiquement le workflow Claude après le setup
      // Passer le workspaceDir complet avec /repo dans l'objet task temporairement
      const taskWithWorkspace = { ...task.toObject(), workspaceDir: `${result.workspaceDir}/repo` }
      await this.aiExecutor.executeWorkflow(result.containerId, taskWithWorkspace)
    }

    return result
  }

  /**
   * Exécute une commande Claude dans le conteneur
   */
  async executeClaudeCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string, task?: any, planMode?: boolean): Promise<string> {
    return this.aiExecutor.executeCommand(containerId, prompt, workdir, aiProvider, model, task, planMode)
  }

  /**
   * Nettoie le conteneur et les fichiers temporaires
   */
  async cleanupTaskContainer(taskId: string): Promise<void> {
    return this.containerCleanup.cleanupTaskContainer(taskId)
  }
}

// Instance par défaut
const defaultTaskContainerManager = new TaskContainerManager()

/**
 * Crée un environnement Docker pour une tâche
 */
export async function createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
  return defaultTaskContainerManager.createTaskContainer(options)
}

/**
 * Exécute une commande Claude dans un conteneur de tâche
 */
export async function executeClaudeInTask(taskId: string, prompt: string): Promise<string> {
  const task = await TaskModel.findById(taskId)
  if (!task || !task.dockerId) {
    throw new Error(`Task ${taskId} has no associated container`)
  }

  return defaultTaskContainerManager.executeClaudeCommand(task.dockerId, prompt)
}

/**
 * Nettoie le conteneur d'une tâche
 */
export async function cleanupTaskContainer(taskId: string): Promise<void> {
  return defaultTaskContainerManager.cleanupTaskContainer(taskId)
}
