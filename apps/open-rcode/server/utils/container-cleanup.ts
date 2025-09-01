import { DockerManager } from './docker'
import type { BaseContainerManager } from './container/base-container-manager'
import { TaskModel } from '../models/Task'
import { createLogger } from './logger'

export class ContainerCleanup {
  private containerManager: BaseContainerManager
  private logger = createLogger('ContainerCleanup')

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  async cleanupTaskContainer(taskId: string): Promise<void> {
    try {
      const task = await TaskModel.findById(taskId)
      if (!task || !task.dockerId) {
        return
      }

      await this.stopAndRemoveContainer(task.dockerId)
      await this.cleanupWorkspaceFiles(taskId)

      // Supprimer la référence du conteneur de la tâche
      task.dockerId = null
      await task.save()

      this.logger.info({ taskId }, 'Cleaned up container and files for task')
    } catch (error) {
      this.logger.error({ taskId, error }, 'Error cleaning up task container')
    }
  }

  private async stopAndRemoveContainer(containerId: string): Promise<void> {
    try {
      await this.containerManager.stopContainer(containerId)
      await this.containerManager.removeContainer(containerId, true)
    } catch (error) {
      this.logger.warn({ containerId }, 'Container may have already been removed')
    }
  }

  private async cleanupWorkspaceFiles(taskId: string): Promise<void> {
    const hostWorkspaceDir = `/tmp/openrcode-workspaces/${taskId}`

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      await execAsync(`rm -rf ${hostWorkspaceDir}`)
    } catch (error) {
      this.logger.warn({ directory: hostWorkspaceDir }, 'Failed to cleanup workspace directory')
    }
  }
}
