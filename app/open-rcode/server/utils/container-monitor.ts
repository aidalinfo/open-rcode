import { CronJob } from 'cron'
import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { connectToDatabase } from './database'
import { createContainerManager, BaseContainerManager } from './container'

export class ContainerMonitor {
  private cronJob: CronJob | null = null
  private containerManager: BaseContainerManager
  private docker: DockerManager // Maintenu pour compatibilité
  private isRunning = false

  constructor(containerOptions?: any) {
    this.containerManager = createContainerManager({ connectionOptions: containerOptions })
    this.docker = new DockerManager(containerOptions) // Fallback pour compatibilité
  }

  /**
   * Démarre le monitoring des conteneurs toutes les 60 secondes
   */
  start(): void {
    if (this.isRunning) {
      console.log('Container monitor is already running')
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
    console.log('Container monitor started - checking every 60 seconds')
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
    console.log('Container monitor stopped')
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
        console.warn(`${containerType} is not available - skipping container check`)
        return
      }

      // Récupérer toutes les tasks avec un containerId (dockerId utilisé pour compatibilité)
      const tasks = await TaskModel.find({
        dockerId: { $exists: true, $ne: null },
        executed: false // Seulement les tasks non terminées
      })

      if (tasks.length === 0) {
        console.log('No active containers to monitor')
        return
      }

      console.log(`Checking ${tasks.length} containers...`)

      for (const task of tasks) {
        try {
          await this.checkSingleContainer(task)
        } catch (error) {
          console.error(`Error checking container for task ${task._id}:`, error)
        }
      }

    } catch (error) {
      console.error('Error in container monitoring:', error)
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
        console.log(`Container ${task.dockerId} no longer exists for task ${task._id}`)
        await this.handleContainerNotFound(task)
        return
      }

      // Vérifier l'état du conteneur (compatible Docker et Kubernetes)
      const status = containerInfo.status.toLowerCase()
      const state = containerInfo.state.toLowerCase()
      
      if (status === 'running' || state === 'running') {
        console.log(`Container ${task.dockerId} is running`)
      } else if (status === 'exited' || state === 'succeeded' || state === 'failed') {
        console.log(`Container ${task.dockerId} has ${status}/${state}`)
        await this.handleContainerExited(task, containerInfo)
      } else if (status === 'dead' || status === 'removing' || state === 'pending') {
        console.log(`Container ${task.dockerId} is ${status}/${state}`)
        await this.handleContainerDead(task)
      } else {
        console.log(`Container ${task.dockerId} status: ${status}/${state}`)
      }

    } catch (error) {
      console.error(`Error checking container ${task.dockerId}:`, error)
      
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
    console.log(`Marking task ${task._id} as completed - container not found`)
    
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
      
      console.log(`Task ${task._id} container exited, updating with logs`)
      
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
        console.log(`Container ${task.dockerId} removed`)
      } catch (removeError) {
        console.log(`Container ${task.dockerId} may have been auto-removed`)
      }
      
    } catch (error) {
      console.error(`Error handling exited container for task ${task._id}:`, error)
      
      task.executed = true
      task.error = `Container exited but failed to retrieve logs: ${error.message}`
      await task.save()
    }
  }

  /**
   * Gère le cas où le conteneur est mort ou en cours de suppression
   */
  private async handleContainerDead(task: any): Promise<void> {
    console.log(`Task ${task._id} container is dead, marking as failed`)
    
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
        console.warn(`${containerType} not available for cleanup`)
        return 0
      }

      const cleanedCount = await this.containerManager.cleanupContainers()
      console.log(`Cleaned up ${cleanedCount} orphaned containers`)
      return cleanedCount
    } catch (error) {
      console.error('Error during container cleanup:', error)
      return 0
    }
  }

  /**
   * Retourne le statut du monitoring
   */
  getStatus(): { isRunning: boolean; nextRun?: string } {
    let nextRun: string | undefined = undefined
    
    if (this.cronJob && this.isRunning) {
      try {
        const nextDate = this.cronJob.nextDate()
        if (nextDate) {
          nextRun = nextDate.toString()
        }
      } catch (error) {
        console.warn('Error getting next run date:', error)
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
    console.log('Container monitoring already started')
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