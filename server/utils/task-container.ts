import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { connectToDatabase } from './database'
import { ContainerSetup } from './container-setup'
import { ClaudeExecutor } from './claude-executor'
import { ContainerCleanup } from './container-cleanup'
import type { TaskContainerOptions, ContainerSetupResult } from './container-setup'

export type { TaskContainerOptions, ContainerSetupResult }

export class TaskContainerManager {
  private docker: DockerManager
  private containerSetup: ContainerSetup
  private claudeExecutor: ClaudeExecutor
  private containerCleanup: ContainerCleanup

  constructor(dockerOptions?: any) {
    this.docker = new DockerManager(dockerOptions)
    this.containerSetup = new ContainerSetup(this.docker)
    this.claudeExecutor = new ClaudeExecutor(this.docker)
    this.containerCleanup = new ContainerCleanup(this.docker)
  }

  /**
   * Crée un environnement Docker pour une tâche avec Claude Code
   */
  async createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    await connectToDatabase()

    const result = await this.containerSetup.setupContainer(options)

    // Mettre à jour la tâche avec l'ID du conteneur
    const task = await TaskModel.findById(options.taskId)
    if (task) {
      task.dockerId = result.containerId
      task.messages.push({
        role: 'assistant',
        content: `🐳 Environnement Docker créé avec succès.\n**Conteneur:** \`${result.containerName}\`\n**ID:** \`${result.containerId.substring(0, 12)}\``,
        timestamp: new Date()
      })
      await task.save()

      // Exécuter automatiquement le workflow Claude après le setup
      await this.claudeExecutor.executeWorkflow(result.containerId, task)
    }

    return result
  }

  /**
   * Exécute une commande Claude dans le conteneur
   */
  async executeClaudeCommand(containerId: string, prompt: string, workdir?: string): Promise<string> {
    return this.claudeExecutor.executeCommand(containerId, prompt, workdir)
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