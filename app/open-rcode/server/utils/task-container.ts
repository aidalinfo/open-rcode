import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { TaskMessageModel } from '../models/TaskMessage'
import { connectToDatabase } from './database'
import { ContainerSetup } from './container-setup'
import { ClaudeExecutor } from './claude-executor'
import { ContainerCleanup } from './container-cleanup'
import type { TaskContainerOptions, ContainerSetupResult } from './container-setup'
import { v4 as uuidv4 } from 'uuid'
import { ContainerFactory } from './container/factory/container-factory'
import type { TaskOrchestrator } from './container/interfaces/task-orchestrator.interface'

export class TaskContainerManager {
  private docker: DockerManager
  private containerSetup: ContainerSetup
  private claudeExecutor: ClaudeExecutor
  private containerCleanup: ContainerCleanup
  private taskOrchestrator: TaskOrchestrator

  constructor(dockerOptions?: any) {
    this.docker = new DockerManager(dockerOptions)
    this.containerSetup = new ContainerSetup(this.docker)
    this.claudeExecutor = new ClaudeExecutor(this.docker)
    this.containerCleanup = new ContainerCleanup(this.docker)
    this.taskOrchestrator = ContainerFactory.getTaskOrchestrator()
  }

  /**
   * Crée un environnement Docker ou Kubernetes pour une tâche avec Claude Code
   */
  async createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    await connectToDatabase()

    let result: ContainerSetupResult

    // Utiliser Kubernetes si MODE=KUBERNETES
    if (ContainerFactory.isKubernetes()) {
      const task = await TaskModel.findById(options.taskId)
      if (!task) {
        throw new Error(`Task ${options.taskId} not found`)
      }

      result = await this.taskOrchestrator.createTaskContainer({
        taskId: options.taskId,
        userId: task.userId,
        environmentId: task.environmentId.toString(),
        customEnv: options.additionalEnvVars
      })

      // Mettre à jour la tâche avec l'ID du conteneur/pod
      task.dockerId = result.containerId
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `☸️ Environnement Kubernetes créé avec succès.\n**Pod:** ${result.containerName}\n**ID:** ${result.containerId}`
      })
      await task.save()

      // Exécuter automatiquement le workflow Claude après le setup
      const prompt = task.prompt || 'help'
      await this.taskOrchestrator.executeAIPrompt(result.containerId, prompt)
    } else {
      // Utiliser Docker par défaut
      result = await this.containerSetup.setupContainer(options)

      // Mettre à jour la tâche avec l'ID du conteneur
      const task = await TaskModel.findById(options.taskId)
      if (task) {
        task.dockerId = result.containerId
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🐳 Environnement Docker créé avec succès.\n**Conteneur:** ${result.containerName}\n**ID:** ${result.containerId.substring(0, 12)}`
        })
        await task.save()

        // Exécuter automatiquement le workflow Claude après le setup
        await this.claudeExecutor.executeWorkflow(result.containerId, task)
      }
    }

    return result
  }

  /**
   * Exécute une commande Claude dans le conteneur
   */
  async executeClaudeCommand(containerId: string, prompt: string, workdir?: string): Promise<string> {
    if (ContainerFactory.isKubernetes()) {
      return this.taskOrchestrator.executeAIPrompt(containerId, prompt)
    }
    return this.claudeExecutor.executeCommand(containerId, prompt, workdir)
  }

  /**
   * Nettoie le conteneur et les fichiers temporaires
   */
  async cleanupTaskContainer(taskId: string): Promise<void> {
    if (ContainerFactory.isKubernetes()) {
      return this.taskOrchestrator.cleanupTaskContainer(taskId)
    }
    return this.containerCleanup.cleanupTaskContainer(taskId)
  }
}

// Instance par défaut
const defaultTaskContainerManager = new TaskContainerManager()

/**
 * Crée un environnement Docker ou Kubernetes pour une tâche
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