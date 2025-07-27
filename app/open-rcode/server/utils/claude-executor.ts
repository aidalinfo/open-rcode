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

    console.log(`🔍 Debug: aiProvider='${aiProvider}', model='${model}'`)

    switch (aiProvider) {
      case 'anthropic-api':
        aiCommand = `claude --verbose --output-format stream-json${modelParam} -p`
        envSetup = 'export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"'
        break
      case 'claude-oauth':
        aiCommand = `claude --verbose --output-format stream-json${modelParam} -p`
        envSetup = 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
        break
      case 'gemini-cli':
        aiCommand = 'gemini -p'
        envSetup = 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
        break
      default:
        aiCommand = `claude --verbose --output-format stream-json${modelParam} -p`
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
    
    // Parser la sortie JSON pour extraire les tool calls et les formater
    const parsedOutput = this.parseClaudeJsonOutput(filteredOutput)
    
    // Combiner pour le retour (pour compatibilité)
    const formattedParts: string[] = []
    
    // Ajouter chaque tool call formaté
    for (const toolCall of parsedOutput.toolCalls) {
      formattedParts.push(this.formatToolCall(toolCall))
    }
    
    // Ajouter les messages texte
    if (parsedOutput.textMessages.length > 0) {
      formattedParts.push('\n💬 **Réponse:**')
      formattedParts.push(parsedOutput.textMessages.join('\n'))
    }
    
    // Ajouter le résultat final si différent des messages
    if (parsedOutput.finalResult && !parsedOutput.textMessages.includes(parsedOutput.finalResult)) {
      formattedParts.push('\n📋 **Résumé:**')
      formattedParts.push(parsedOutput.finalResult)
    }
    
    return formattedParts.length > 0 ? formattedParts.join('\n\n') : filteredOutput
  }

  async executeCommandOld(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string): Promise<string> {
    // Déterminer la commande à exécuter selon le provider
    let aiCommand = 'claude --output-format stream-json -p'
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
        await this.executeAndSaveToolMessages(containerId, userMessage.content, workspaceDir, aiProvider, model, task, 'Exécution de la tâche');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const gitStatusBefore = await this.checkGitStatus(containerId, workspaceDir);

      console.log(`Executing second AI command to summarize changes (provider: ${aiProvider}, model: ${model})`);

      const summaryOutput = await this.executeAndSaveToolMessages(
        containerId,
        'Résume les modifications que tu viens de faire dans ce projet. Utilise git status et git diff pour voir les changements.',
        workspaceDir,
        aiProvider,
        model,
        task,
        'Résumé des modifications'
      );

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
      // Détecter si on utilise Kubernetes
      const isKubernetes = this.containerManager.constructor.name === 'KubernetesAdapter';
      const resourceType = isKubernetes ? 'pod' : 'conteneur';
      const resourceTypeCapitalized = isKubernetes ? 'Pod' : 'Conteneur Docker';
      
      // Nettoyer le conteneur/pod après l'exécution (succès ou échec)
      console.log(`Cleaning up ${resourceType} for task ${task._id}`);
      try {
        await this.containerManager.removeContainer(containerId, true);
        console.log(`${resourceTypeCapitalized} ${containerId} cleaned up successfully`);
        
        // Supprimer la référence du conteneur de la tâche
        await TaskModel.findByIdAndUpdate(task._id, { dockerId: null });
        
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🧹 **Nettoyage automatique:** Le ${resourceType} a été supprimé après l'exécution de la tâche.`
        });
      } catch (cleanupError: any) {
        console.error(`Failed to cleanup ${resourceType} ${containerId}:`, cleanupError);
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `⚠️ **Attention:** Échec du nettoyage automatique du ${resourceType}. Le ${resourceType} devra être supprimé manuellement.`
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

  private parseClaudeJsonOutput(rawOutput: string): { toolCalls: any[], textMessages: string[], finalResult: string } {
    try {
      const lines = rawOutput.split('\n')
      let toolCalls: any[] = []
      let toolResults: Map<string, any> = new Map()
      let textMessages: string[] = []
      let finalResult = ''
      
      for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('[') && line.trim().endsWith(']')) continue
        
        try {
          const jsonData = JSON.parse(line.trim())
          
          if (jsonData.type === 'assistant' && jsonData.message?.content) {
            for (const content of jsonData.message.content) {
              if (content.type === 'tool_use') {
                toolCalls.push({
                  id: content.id,
                  name: content.name,
                  input: content.input
                })
              } else if (content.type === 'text' && content.text?.trim()) {
                textMessages.push(content.text.trim())
              }
            }
          } else if (jsonData.type === 'user' && jsonData.message?.content) {
            for (const content of jsonData.message.content) {
              if (content.type === 'tool_result') {
                toolResults.set(content.tool_use_id, content)
              }
            }
          } else if (jsonData.type === 'result' && jsonData.result) {
            finalResult = jsonData.result
          }
        } catch (parseError) {
          continue
        }
      }
      
      // Associer les résultats aux tool calls
      const toolCallsWithResults = toolCalls.map(toolCall => ({
        ...toolCall,
        result: toolResults.get(toolCall.id)
      }))
      
      return {
        toolCalls: toolCallsWithResults,
        textMessages,
        finalResult
      }
      
    } catch (error) {
      console.error('Error parsing Claude JSON output:', error)
      return {
        toolCalls: [],
        textMessages: [],
        finalResult: rawOutput
      }
    }
  }

  private formatToolCall(toolCall: any): string {
    const parts: string[] = []
    
    parts.push(`🔧 **${toolCall.name}**`)
    
    // Formater l'input selon le type de tool de façon générique
    if (toolCall.input) {
      const inputEntries = Object.entries(toolCall.input)
      
      if (inputEntries.length === 1) {
        const [key, value] = inputEntries[0]
        
        // Cas spéciaux avec émojis appropriés
        if (key === 'file_path') {
          const emoji = toolCall.name === 'Read' ? '📁' : toolCall.name === 'Write' ? '📝' : toolCall.name === 'Edit' ? '✏️' : '📄'
          const action = toolCall.name === 'Read' ? 'Lecture' : toolCall.name === 'Write' ? 'Écriture' : toolCall.name === 'Edit' ? 'Édition' : 'Fichier'
          parts.push(`   ${emoji} ${action}: \`${value}\``)
        } else if (key === 'command') {
          parts.push(`   💻 Commande: \`${value}\``)
        } else if (key === 'path') {
          parts.push(`   📂 Chemin: \`${value}\``)
        } else if (key === 'pattern') {
          parts.push(`   🔍 Motif: \`${value}\``)
        } else if (key === 'url') {
          parts.push(`   🌐 URL: \`${value}\``)
        } else if (key === 'query') {
          parts.push(`   🔎 Recherche: \`${value}\``)
        } else if (key === 'todos' && Array.isArray(value)) {
          parts.push(`   📝 Todos: ${value.length} tâches`)
        } else {
          // Formater les objets complexes
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              parts.push(`   ⚙️ ${key}: ${value.length} éléments`)
            } else {
              const formattedValue = JSON.stringify(value, null, 2).replace(/\n/g, ' ').replace(/\s+/g, ' ')
              if (formattedValue.length > 100) {
                parts.push(`   ⚙️ ${key}: ${formattedValue.substring(0, 100)}...`)
              } else {
                parts.push(`   ⚙️ ${key}: ${formattedValue}`)
              }
            }
          } else {
            parts.push(`   ⚙️ ${key}: \`${value}\``)
          }
        }
      } else if (inputEntries.length > 1) {
        // Plusieurs paramètres
        parts.push(`   ⚙️ Paramètres: ${inputEntries.map(([key, value]) => {
          const formattedValue = typeof value === 'object' ? JSON.stringify(value, null, 2).replace(/\n/g, ' ').replace(/\s+/g, ' ') : value;
          return `${key}=${formattedValue}`;
        }).join(', ')}`)
      }
    }
    
    // Ajouter le résultat
    if (toolCall.result) {
      if (toolCall.result.is_error) {
        parts.push(`   ❌ Erreur: ${toolCall.result.content}`)
      } else if (toolCall.result.content && toolCall.result.content.length < 200) {
        parts.push(`   ✅ Résultat: ${toolCall.result.content}`)
      } else {
        parts.push(`   ✅ Succès`)
      }
    }
    
    return parts.join('\n')
  }

  async executeAndSaveToolMessages(
    containerId: string, 
    prompt: string, 
    workdir: string, 
    aiProvider: string, 
    model: string, 
    task: any, 
    actionLabel: string
  ): Promise<string> {
    
    // Exécuter la commande Claude
    const result = await this.executeWithStreamingBash(containerId, `
      # Create and change to working directory
      mkdir -p "${workdir}"
      cd "${workdir}"
      
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
      
      ${this.getEnvSetup(aiProvider)}
      ${this.getAiCommand(aiProvider, model)} "${prompt.replace(/"/g, '\"')}"
    `, (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim() && !line.includes('===')) {
          console.log(`🤖 Claude: ${line.trim()}`)
        }
      })
    })

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    // Filtrer le chemin indésirable
    let filteredOutput = result.stdout
    const unwantedPathPattern = /^\/root\/\.nvm\/versions\/node\/v[\d.]+\/bin\/claude\s*\n?/
    filteredOutput = filteredOutput.replace(unwantedPathPattern, '')
    
    // Parser la sortie JSON
    const parsedOutput = this.parseClaudeJsonOutput(filteredOutput)
    const aiProviderLabel = this.getAiProviderLabel(aiProvider)
    
    // Créer un message pour chaque tool call
    for (const toolCall of parsedOutput.toolCalls) {
      const toolContent = this.formatToolCall(toolCall)
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n${toolContent}`
      })
    }
    
    // Créer un message pour les réponses texte s'il y en a
    if (parsedOutput.textMessages.length > 0) {
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n💬 **Réponse:**\n${parsedOutput.textMessages.join('\n')}`
      })
    }
    
    // Créer un message pour le résultat final s'il est différent
    if (parsedOutput.finalResult && !parsedOutput.textMessages.includes(parsedOutput.finalResult)) {
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n📋 **Résumé:**\n${parsedOutput.finalResult}`
      })
    }
    
    // Retourner le résultat final pour la création de PR
    return parsedOutput.finalResult || parsedOutput.textMessages.join('\n') || 'Tâche terminée'
  }

  private getEnvSetup(aiProvider: string): string {
    switch (aiProvider) {
      case 'anthropic-api':
        return 'export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"'
      case 'claude-oauth':
        return 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
      case 'gemini-cli':
        return 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
      default:
        return 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
    }
  }

  private getAiCommand(aiProvider: string, model?: string): string {
    const modelParam = model ? ` --model ${model}` : ''
    
    switch (aiProvider) {
      case 'anthropic-api':
        return `claude --verbose --output-format stream-json${modelParam} -p`
      case 'claude-oauth':
        return `claude --verbose --output-format stream-json${modelParam} -p`
      case 'gemini-cli':
        return 'gemini -p'
      default:
        return `claude --verbose --output-format stream-json${modelParam} -p`
    }
  }
}