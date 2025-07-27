import { BaseContainerManager } from './container/base-container-manager'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { PullRequestCreator } from './pull-request-creator'
import { TaskMessageModel } from '../models/TaskMessage'
import { CountRequestModel } from '../models/CountRequest'
import { v4 as uuidv4 } from 'uuid'

export class ClaudeExecutor {
  private containerManager: BaseContainerManager

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  async executeCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string): Promise<string> {
    const onOutput = (data: string) => {
      // Afficher la sortie Claude en temps réel
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim() && !line.includes('===')) {
          console.log(`🤖 Claude: ${line.trim()}`)
        }
      })
    }

    // Déterminer la commande à exécuter selon le provider
    let aiCommand = 'claude -p'
    let envSetup = ''

    // Ajouter le paramètre --model si spécifié
    const modelParam = model ? ` --model ${model}` : ''

    switch (aiProvider) {
      case 'anthropic-api':
        aiCommand = `claude${modelParam} -p`
        envSetup = 'export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"'
        break
      case 'claude-oauth':
        aiCommand = `claude${modelParam} -p`
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
        break
      case 'gemini-cli':
        aiCommand = 'gemini -p'
        envSetup = 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
        break
      default:
        aiCommand = `claude${modelParam} -p`
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
    }

    const script = `
      # Create and change to working directory
      mkdir -p "${workdir || '/tmp/workspace'}"
      cd "${workdir || '/tmp/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      # Charger l'environnement Node et npm global (version bash)
      [ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && source /etc/profile || true
      
      # Vérifier que Claude est installé
      which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)
      
      ${envSetup}
      ${aiCommand} "${prompt.replace(/"/g, '\"')}"
    `

    const result = await this.executeWithStreamingBash(containerId, script, onOutput)

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    // Filtrer le chemin indésirable du début de la sortie
    let filteredOutput = result.stdout
    const unwantedPathPattern = /^\/root\/\.nvm\/versions\/node\/v[\d.]+\/bin\/claude\s*\n?/
    filteredOutput = filteredOutput.replace(unwantedPathPattern, '')
    
    return filteredOutput
  }

  async executeCommandOld(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string): Promise<string> {
    // Déterminer la commande à exécuter selon le provider
    let aiCommand = 'claude -p'
    let envSetup = ''

    // Ajouter le paramètre --model si spécifié
    const modelParam = model ? ` --model ${model}` : ''

    switch (aiProvider) {
      case 'anthropic-api':
        aiCommand = `claude${modelParam} -p`
        envSetup = 'export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"'
        break
      case 'claude-oauth':
        aiCommand = `claude${modelParam} -p`
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
        break
      case 'gemini-cli':
        aiCommand = 'gemini -p'
        envSetup = 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
        break
      default:
        // Fallback pour la compatibilité
        aiCommand = `claude${modelParam} -p`
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
    }

    const script = `
      cd "${workdir || '/tmp/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      # Charger l'environnement Node et npm global (compatible sh/bash)
      [ -f /root/.nvm/nvm.sh ] && . /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && . /etc/profile || true
      
      # Vérifier que Claude est installé
      which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)
      
      ${envSetup}
      ${aiCommand} "${prompt.replace(/"/g, '\"')}"
    `

    const result = await this.containerManager.executeInContainer({
      containerId,
      command: ['sh', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    // Filtrer le chemin indésirable du début de la sortie
    let filteredOutput = result.stdout
    const unwantedPathPattern = /^\/root\/\.nvm\/versions\/node\/v[\d.]+\/bin\/claude\s*\n?/
    filteredOutput = filteredOutput.replace(unwantedPathPattern, '')
    
    return filteredOutput
  }

  async executeConfigurationScript(containerId: string, configScript: string, workdir?: string): Promise<string> {
    const onOutput = (data: string) => {
      // Afficher la sortie en temps réel (sans les retours à la ligne vides)
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`📋 Config: ${line.trim()}`)
        }
      })
    }

    const script = `
      # Create and change to working directory
      mkdir -p "${workdir || '/tmp/workspace'}"
      cd "${workdir || '/tmp/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      [ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && source /etc/profile || true
      echo "=== Executing configuration script ==="
      ${configScript}
      echo "=== Configuration script completed ==="
    `

    const result = await this.executeWithStreamingBash(containerId, script, onOutput)

    if (result.exitCode !== 0) {
      console.error(`❌ Configuration script failed:`, result.stderr)
      throw new Error(`Configuration script failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    console.log(`✅ Configuration script completed successfully`)
    return result.stdout
  }

  private async executeWithStreaming(containerId: string, script: string, onOutput?: (data: string) => void): Promise<ExecuteResult> {
    // Vérifier si c'est Kubernetes pour utiliser le streaming
    if (this.containerManager.constructor.name === 'KubernetesAdapter') {
      const kubernetesAdapter = this.containerManager as any
      if (kubernetesAdapter.executeInContainerWithStreaming) {
        return kubernetesAdapter.executeInContainerWithStreaming({
          containerId,
          command: ['sh', '-c', script],
          user: 'root',
          environment: { 'HOME': '/root' }
        }, onOutput)
      }
    }
    
    // Fallback pour Docker (pas de streaming)
    return this.containerManager.executeInContainer({
      containerId,
      command: ['sh', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })
  }

  private async executeWithStreamingBash(containerId: string, script: string, onOutput?: (data: string) => void): Promise<ExecuteResult> {
    // Vérifier si c'est Kubernetes pour utiliser le streaming
    if (this.containerManager.constructor.name === 'KubernetesAdapter') {
      const kubernetesAdapter = this.containerManager as any
      if (kubernetesAdapter.executeInContainerWithStreaming) {
        return kubernetesAdapter.executeInContainerWithStreaming({
          containerId,
          command: ['/bin/bash', '-c', script],
          user: 'root',
          environment: { 'HOME': '/root' }
        }, onOutput)
      }
    }
    
    // Fallback pour Docker (pas de streaming)
    return this.containerManager.executeInContainer({
      containerId,
      command: ['/bin/bash', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })
  }

  async executeConfigurationScriptOld(containerId: string, configScript: string, workdir?: string): Promise<string> {
    const script = `
      cd "${workdir || '/tmp/workspace'}"
      
      # Configuration Git
      git config --global user.email "ccweb@example.com" || true
      git config --global user.name "CCWeb Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      echo "=== Executing configuration script ==="
      ${configScript}
      echo "=== Configuration script completed ==="
    `

    const result = await this.containerManager.executeInContainer({
      containerId,
      command: ['sh', '-c', script],
      user: 'root',
      environment: { 'HOME': '/root' }
    })

    if (result.exitCode !== 0) {
      console.error(`❌ Configuration script failed:`, result.stderr)
      throw new Error(`Configuration script failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    console.log(`✅ Configuration script output:`, result.stdout.substring(0, 500) + (result.stdout.length > 500 ? '...' : ''))
    return result.stdout
  }

  async executeWorkflow(containerId: string, task: any): Promise<void> {
    const updateTaskStatus = async (status: string, error?: string) => {
      await TaskModel.findByIdAndUpdate(task._id, { 
        status, 
        error: error || null,
        updatedAt: new Date()
      });
    };

    try {
      await updateTaskStatus('running');
      console.log(`Starting Claude workflow for task ${task._id}`);

      const environment = await EnvironmentModel.findById(task.environmentId);
      if (!environment) {
        throw new Error(`Environment ${task.environmentId} not found`);
      }

      const workspaceDir = task.workspaceDir || `/tmp/workspace/${environment.repository || 'ccweb'}`;
      console.log(`🔧 Using workspace directory: ${workspaceDir}`);
      const aiProvider = environment.aiProvider || 'anthropic-api';
      const model = environment.model || 'sonnet';

      if (environment.configurationScript && environment.configurationScript.trim()) {
        console.log('Executing configuration script');
        try {
          const configOutput = await this.executeConfigurationScript(containerId, environment.configurationScript, workspaceDir);
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `⚙️ **Configuration du projet:**\n\`\`\`\n${configOutput}\n\`\`\``
          });
          console.log('Configuration script completed successfully');
        } catch (configError: any) {
          console.error('Configuration script failed:', configError);
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `❌ **Erreur lors de la configuration:**\n\`\`\`\n${configError.message}\n\`\`\``
          });
          await updateTaskStatus('failed', configError.message);
          return;
        }
      }

      const userMessage = await TaskMessageModel.findOne({ taskId: task._id, role: 'user' }).sort({ createdAt: 1 });

      if (userMessage) {
        console.log(`Executing first AI command with user text (provider: ${aiProvider}, model: ${model})`);
        const firstOutput = await this.executeCommand(containerId, userMessage.content, workspaceDir, aiProvider, model);
        const aiProviderLabel = this.getAiProviderLabel(aiProvider);
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **${aiProviderLabel} (${model}) - Exécution de la tâche:**\n\`\`\`\n${firstOutput}\n\`\`\``
        });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const gitStatusBefore = await this.checkGitStatus(containerId, workspaceDir);

      console.log(`Executing second AI command to summarize changes (provider: ${aiProvider}, model: ${model})`);

      const summaryOutput = await this.executeCommand(
        containerId,
        'Résume les modifications que tu viens de faire dans ce projet. Utilise git status et git diff pour voir les changements.',
        workspaceDir,
        aiProvider,
        model
      );

      const aiProviderLabel = this.getAiProviderLabel(aiProvider);
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `📋 **${aiProviderLabel} (${model}) - Résumé des modifications:**\n\`\`\`\n${summaryOutput}\n\`\`\``
      });

      const prCreator = new PullRequestCreator(this.containerManager);
      await prCreator.createFromChanges(containerId, task, summaryOutput);

      // Créer un document CountRequest pour suivre l'utilisation
      await CountRequestModel.create({
        userId: task.userId,
        environmentId: task.environmentId,
        model: model,
        taskId: task._id
      });
      console.log(`CountRequest created for task ${task._id}`);

      await updateTaskStatus('completed');
      console.log(`Claude workflow completed for task ${task._id}`);

    } catch (error: any) {
      console.error(`Error in Claude workflow for task ${task._id}:`, error);
      await updateTaskStatus('failed', error.message);
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `❌ **Erreur dans le workflow Claude:** ${error.message}`
      });
    } finally {
      // Nettoyer le conteneur après l'exécution (succès ou échec)
      console.log(`Cleaning up container for task ${task._id}`);
      try {
        await this.containerManager.removeContainer(containerId, true);
        console.log(`Container ${containerId} cleaned up successfully`);
        
        // Supprimer la référence du conteneur de la tâche
        await TaskModel.findByIdAndUpdate(task._id, { dockerId: null });
        
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🧹 **Nettoyage automatique:** Le pod a été supprimé après l'exécution de la tâche.`
        });
      } catch (cleanupError: any) {
        console.error(`Failed to cleanup container ${containerId}:`, cleanupError);
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `⚠️ **Attention:** Échec du nettoyage automatique du conteneur. Le conteneur devra être supprimé manuellement.`
        });
      }
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

      const result = await this.containerManager.executeInContainer({
        containerId,
        command: ['sh', '-c', script],
        user: 'root'
      })

      return result.stdout
    } catch (error: any) {
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