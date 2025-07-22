import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'

export class ContainerCleanup {
  private docker: DockerManager

  constructor(docker: DockerManager) {
    this.docker = docker
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

      console.log(`Cleaned up container and files for task ${taskId}`)
    } catch (error) {
      console.error(`Error cleaning up task container for ${taskId}:`, error)
    }
  }

  private async stopAndRemoveContainer(containerId: string): Promise<void> {
    try {
      await this.docker.stopContainer(containerId)
      await this.docker.removeContainer(containerId, true)
    } catch (error) {
      console.warn(`Container ${containerId} may have already been removed`)
    }
  }

  private async cleanupWorkspaceFiles(taskId: string): Promise<void> {
    const hostWorkspaceDir = `/tmp/ccweb-workspaces/${taskId}`
    
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      await execAsync(`rm -rf ${hostWorkspaceDir}`)
    } catch (error) {
      console.warn(`Failed to cleanup workspace directory: ${hostWorkspaceDir}`)
    }
  }
}