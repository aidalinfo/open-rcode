import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { PullRequestCreator } from './pull-request-creator'
import { TaskMessageModel } from '../models/TaskMessage'
import { v4 as uuidv4 } from 'uuid'

export class ClaudeExecutor {
  private docker: DockerManager

  constructor(docker: DockerManager) {
    this.docker = docker
  }

  async executeCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string): Promise<string> {
    // Déterminer la commande à exécuter selon le provider
    let aiCommand = 'claude -p'
    let envSetup = ''

    switch (aiProvider) {
      case 'anthropic-api':
        aiCommand = 'claude -p'
        envSetup = 'export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"'
        break
      case 'claude-oauth':
        aiCommand = 'claude -p'
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
        break
      case 'gemini-cli':
        aiCommand = 'gemini -p'
        envSetup = 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
        break
      default:
        // Fallback pour la compatibilité
        aiCommand = 'claude -p'
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
    }

    const script = `
      cd "${workdir || '/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      ${envSetup}
      ${aiCommand} "${prompt.replace(/"/g, '\"')}"
    `

    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-l', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    return result.stdout
  }

  async executeConfigurationScript(containerId: string, configScript: string, workdir?: string): Promise<string> {
    const script = `
      cd "${workdir || '/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      echo "=== Executing configuration script ==="
      ${configScript}
      echo "=== Configuration script completed ==="
    `

    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-l', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })

    if (result.exitCode !== 0) {
      throw new Error(`Configuration script failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
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
      const aiProvider = environment.aiProvider || 'anthropic-api'
      
      // Exécuter le script de configuration en premier si défini
      if (environment.configurationScript && environment.configurationScript.trim()) {
        console.log('Executing configuration script')
        
        try {
          const configOutput = await this.executeConfigurationScript(containerId, environment.configurationScript, workspaceDir)
          
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `⚙️ **Configuration du projet:**\n\`\`\`\n${configOutput}\n\`\`\``
          })
          
          console.log('Configuration script completed successfully')
        } catch (configError) {
          console.error('Configuration script failed:', configError)
          
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `❌ **Erreur lors de la configuration:**\n\`\`\`\n${configError.message}\n\`\`\``
          })
          
          // Ne pas continuer si la configuration échoue
          return
        }
      }
      
      const userMessage = await TaskMessageModel.findOne({ taskId: task._id, role: 'user' }).sort({ createdAt: 1 })
      
      if (userMessage) {
        console.log(`Executing first AI command with user text (provider: ${aiProvider})`)
        
        const firstOutput = await this.executeCommand(containerId, userMessage.content, workspaceDir, aiProvider)
        
        const aiProviderLabel = this.getAiProviderLabel(aiProvider)
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **${aiProviderLabel} - Exécution de la tâche:**\n\`\`\`\n${firstOutput}\n\`\`\``
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const gitStatusBefore = await this.checkGitStatus(containerId, workspaceDir)
      
      console.log(`Executing second AI command to summarize changes (provider: ${aiProvider})`)
      
      const summaryOutput = await this.executeCommand(
        containerId,
        'Résume les modifications que tu viens de faire dans ce projet. Utilise git status et git diff pour voir les changements.',
        workspaceDir,
        aiProvider
      )
      
      const aiProviderLabel = this.getAiProviderLabel(aiProvider)
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant', 
        content: `📋 **${aiProviderLabel} - Résumé des modifications:**\n\`\`\`\n${summaryOutput}\n\`\`\``
      })
      
      const prCreator = new PullRequestCreator(this.docker)
      await prCreator.createFromChanges(containerId, task, summaryOutput)
      
      console.log(`Claude workflow completed for task ${task._id}`)
      
    } catch (error) {
      console.error(`Error in Claude workflow for task ${task._id}:`, error)
      
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `❌ **Erreur dans le workflow Claude:** ${error.message}`
      })
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

  private getAiProviderLabel(provider: string): string {
    const labels = {
      'anthropic-api': 'Claude API',
      'claude-oauth': 'Claude Code',
      'gemini-cli': 'Gemini'
    }
    return labels[provider as keyof typeof labels] || provider
  }
}