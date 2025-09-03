import { CronJob } from 'cron'
import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { connectToDatabase } from './database'
import type { BaseContainerManager } from './container'
import { createContainerManager } from './container'
import { createLogger } from './logger'

export class ContainerMonitor {
  private cronJob: CronJob | null = null
  private containerManager: BaseContainerManager
  private docker: DockerManager // Maintenu pour compatibilité
  private isRunning = false
  private logger = createLogger('ContainerMonitor')

  constructor(containerOptions?: any) {
    this.containerManager = createContainerManager({ connectionOptions: containerOptions })
    this.docker = new DockerManager(containerOptions) // Fallback pour compatibilité
  }

  /**
   * Démarre le monitoring des conteneurs toutes les 60 secondes
   */
  start(): void {
    if (this.isRunning) {
      this.logger.info('Container monitor is already running')
      return
    }

    // Cron job toutes les 60 secondes (chaque minute)
    this.cronJob = new CronJob(
      '0 * * * * *', // Chaque minute à la seconde 0
      async () => {
        await this.checkContainers()
      },
      null, // onComplete
      true, // start
      'Europe/Paris' // timezone
    )

    this.isRunning = true
    this.logger.info('Container monitor started - checking every 60 seconds')
  }

  /**
   * Arrête le monitoring
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
    }
    this.isRunning = false
    this.logger.info('Container monitor stopped')
  }

  /**
   * Vérifie l'état de tous les conteneurs liés aux tasks
   */
  private async checkContainers(): Promise<void> {
    try {
      await connectToDatabase()

      // Vérifier si le gestionnaire de conteneurs est disponible
      const isAvailable = await this.containerManager.isAvailable()
      if (!isAvailable) {
        const containerType = process.env.CONTAINER_MODE?.toLowerCase() === 'kubernetes' ? 'Kubernetes' : 'Docker'
        this.logger.warn({ containerType }, 'Container runtime not available - skipping check')
        return
      }

      // Récupérer toutes les tasks avec un containerId (dockerId utilisé pour compatibilité)
      const tasks = await TaskModel.find({
        dockerId: { $exists: true, $ne: null },
        executed: false // Seulement les tasks non terminées
      })

      if (tasks.length === 0) {
        this.logger.debug('No active containers to monitor')
        return
      }

      this.logger.debug({ count: tasks.length }, 'Checking containers')

      for (const task of tasks) {
        try {
          await this.checkSingleContainer(task)
        } catch (error) {
          this.logger.error({ taskId: task._id, error }, 'Error checking container')
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Error in container monitoring')
    }
  }

  /**
   * Vérifie l'état d'un conteneur spécifique
   */
  private async checkSingleContainer(task: any): Promise<void> {
    if (!task.dockerId) return

    try {
      const containerInfo = await this.containerManager.getContainerInfo(task.dockerId)

      if (!containerInfo) {
        // Le conteneur n'existe plus
        this.logger.info({ containerId: task.dockerId, taskId: task._id }, 'Container no longer exists')
        await this.handleContainerNotFound(task)
        return
      }

      // Vérifier l'état du conteneur (compatible Docker et Kubernetes)
      const status = containerInfo.status.toLowerCase()
      const state = containerInfo.state.toLowerCase()

      if (status === 'running' || state === 'running') {
        this.logger.debug({ containerId: task.dockerId }, 'Container is running')
      } else if (status === 'exited' || state === 'succeeded' || state === 'failed') {
        this.logger.info({ containerId: task.dockerId, status, state }, 'Container has exited')
        await this.handleContainerExited(task, containerInfo)
      } else if (status === 'dead' || status === 'removing' || state === 'pending') {
        this.logger.warn({ containerId: task.dockerId, status, state }, 'Container is dead/removing')
        await this.handleContainerDead(task)
      } else {
        this.logger.debug({ containerId: task.dockerId, status, state }, 'Container status')
      }
    } catch (error) {
      this.logger.error({ containerId: task.dockerId, error }, 'Error checking container')

      // Si le conteneur est introuvable, le marquer comme non trouvé
      if (error.message.includes('No such container')) {
        await this.handleContainerNotFound(task)
      }
    }
  }

  /**
   * Gère le cas où le conteneur n'est plus trouvé
   */
  private async handleContainerNotFound(task: any): Promise<void> {
    this.logger.info({ taskId: task._id }, 'Marking task as completed - container not found')

    task.executed = true
    task.error = 'Container not found - may have been auto-removed'
    task.messages.push({
      role: 'assistant',
      content: '⚠️ Le conteneur a été supprimé automatiquement.',
      timestamp: new Date()
    })

    await task.save()
  }

  /**
   * Gère le cas où le conteneur s'est arrêté
   */
  private async handleContainerExited(task: any, containerInfo: any): Promise<void> {
    try {
      // Récupérer les logs du conteneur
      const logs = await this.containerManager.getContainerLogs(task.dockerId, 1000)

      this.logger.info({ taskId: task._id }, 'Container exited, updating with logs')

      task.executed = true
      task.messages.push({
        role: 'assistant',
        content: `✅ Exécution terminée.\n\n**Logs:**\n\`\`\`\n${logs}\n\`\`\``,
        timestamp: new Date()
      })

      await task.save()

      // Nettoyer le conteneur
      try {
        await this.containerManager.removeContainer(task.dockerId, true)
        this.logger.debug({ containerId: task.dockerId }, 'Container removed')
      } catch (removeError) {
        this.logger.debug({ containerId: task.dockerId }, 'Container may have been auto-removed')
      }
    } catch (error) {
      this.logger.error({ taskId: task._id, error }, 'Error handling exited container')

      task.executed = true
      task.error = `Container exited but failed to retrieve logs: ${error.message}`
      await task.save()
    }
  }

  /**
   * Gère le cas où le conteneur est mort ou en cours de suppression
   */
  private async handleContainerDead(task: any): Promise<void> {
    this.logger.warn({ taskId: task._id }, 'Container is dead, marking task as failed')

    task.executed = true
    task.error = 'Container died unexpectedly'
    task.messages.push({
      role: 'assistant',
      content: '❌ Le conteneur s\'est arrêté de manière inattendue.',
      timestamp: new Date()
    })

    await task.save()
  }

  /**
   * Nettoie manuellement tous les conteneurs orphelins
   */
  async cleanupOrphanedContainers(): Promise<number> {
    try {
      const isAvailable = await this.containerManager.isAvailable()
      if (!isAvailable) {
        const containerType = process.env.CONTAINER_MODE?.toLowerCase() === 'kubernetes' ? 'Kubernetes' : 'Docker'
        this.logger.warn({ containerType }, 'Container runtime not available for cleanup')
        return 0
      }

      const cleanedCount = await this.containerManager.cleanupContainers()
      this.logger.info({ cleanedCount }, 'Cleaned up orphaned containers')
      return cleanedCount
    } catch (error) {
      this.logger.error({ error }, 'Error during container cleanup')
      return 0
    }
  }

  /**
   * Retourne le statut du monitoring
   */
  getStatus(): { isRunning: boolean, nextRun?: string } {
    let nextRun: string | undefined = undefined

    if (this.cronJob && this.isRunning) {
      try {
        const nextDate = this.cronJob.nextDate()
        if (nextDate) {
          nextRun = nextDate.toString()
        }
      } catch (error) {
        this.logger.debug({ error }, 'Error getting next run date')
      }
    }

    return {
      isRunning: this.isRunning,
      nextRun
    }
  }
}

// Instance globale du monitor
let globalMonitor: ContainerMonitor | null = null

/**
 * Démarre le monitoring global des conteneurs
 */
export function startContainerMonitoring(containerOptions?: any): ContainerMonitor {
  if (globalMonitor) {
    createLogger('ContainerMonitor').info('Container monitoring already started')
    return globalMonitor
  }

  globalMonitor = new ContainerMonitor(containerOptions)
  globalMonitor.start()
  return globalMonitor
}

/**
 * Arrête le monitoring global des conteneurs
 */
export function stopContainerMonitoring(): void {
  if (globalMonitor) {
    globalMonitor.stop()
    globalMonitor = null
  }
}

/**
 * Retourne l'instance globale du monitor
 */
export function getContainerMonitor(): ContainerMonitor | null {
  return globalMonitor
}
