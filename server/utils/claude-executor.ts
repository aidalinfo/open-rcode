import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { PullRequestCreator } from './pull-request-creator'

export class ClaudeExecutor {
  private docker: DockerManager

  constructor(docker: DockerManager) {
    this.docker = docker
  }

  async executeCommand(containerId: string, prompt: string, workdir?: string): Promise<string> {
    const script = `
      cd "${workdir || '/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"
      claude -p "${prompt.replace(/"/g, '\\"')}"
    `

    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-l', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })

    if (result.exitCode !== 0) {
      throw new Error(`Claude command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    return result.stdout
  }

  async executeWorkflow(containerId: string, task: any): Promise<void> {
    try {
      console.log(`Starting Claude workflow for task ${task._id}`)
      
      const environment = await EnvironmentModel.findById(task.environmentId)
      if (!environment) {
        throw new Error(`Environment ${task.environmentId} not found`)
      }
      
      const workspaceDir = `/workspace/${environment.repository || 'ccweb'}/repo`
      const userMessage = task.messages.find((msg: any) => msg.role === 'user')?.content
      
      if (userMessage) {
        console.log('Executing first Claude command with user text')
        
        const firstOutput = await this.executeCommand(containerId, userMessage, workspaceDir)
        
        task.messages.push({
          role: 'assistant',
          content: `🤖 **Claude - Exécution de la tâche:**\n\`\`\`\n${firstOutput}\n\`\`\``,
          timestamp: new Date()
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const gitStatusBefore = await this.checkGitStatus(containerId, workspaceDir)
      
      console.log('Executing second Claude command to summarize changes')
      
      const summaryOutput = await this.executeCommand(
        containerId,
        'Résume les modifications que tu viens de faire dans ce projet. Utilise "git status" et "git diff" pour voir les changements.',
        workspaceDir
      )
      
      task.messages.push({
        role: 'assistant', 
        content: `📋 **Claude - Résumé des modifications:**\n\`\`\`\n${summaryOutput}\n\`\`\``,
        timestamp: new Date()
      })
      
      await task.save()
      
      const prCreator = new PullRequestCreator(this.docker)
      await prCreator.createFromChanges(containerId, task, summaryOutput)
      
      console.log(`Claude workflow completed for task ${task._id}`)
      
    } catch (error) {
      console.error(`Error in Claude workflow for task ${task._id}:`, error)
      
      task.messages.push({
        role: 'assistant',
        content: `❌ **Erreur dans le workflow Claude:** ${error.message}`,
        timestamp: new Date()
      })
      await task.save()
    }
  }

  private async checkGitStatus(containerId: string, workdir: string): Promise<string> {
    try {
      const script = `
        cd "${workdir}"
        git config --global --add safe.directory "${workdir}" || true
        echo "=== Current directory ==="
        pwd
        echo "=== Git status ==="
        git status --porcelain
        echo "=== Git diff (staged) ==="
        git diff --cached
        echo "=== Git diff (unstaged) ==="
        git diff
        echo "=== Git log (last 3 commits) ==="
        git log --oneline -3
      `

      const result = await this.docker.executeInContainer({
        containerId,
        command: ['bash', '-l', '-c', script],
        user: 'root'
      })

      return result.stdout
    } catch (error) {
      console.error(`Error checking Git status in container ${containerId}:`, error)
      return `Error: ${error.message}`
    }
  }
}