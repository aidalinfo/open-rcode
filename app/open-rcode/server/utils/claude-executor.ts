import { BaseContainerManager } from './container/base-container-manager'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { PullRequestCreator } from './pull-request-creator'
import { TaskMessageModel } from '../models/TaskMessage'
import { CountRequestModel } from '../models/CountRequest'
import { UserCostModel } from '../models/UserCost'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from './logger'

export class ClaudeExecutor {
  private containerManager: BaseContainerManager
  private logger = createLogger('ClaudeExecutor')

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  async executeCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string, task?: any, planMode?: boolean): Promise<string> {
    // Le mode plan permet à Claude de planifier son approche avant l'exécution
    // Il fonctionne en deux phases :
    // 1. Phase de planification : Claude génère un plan structuré avec l'outil ExitPlanMode
    // 2. Phase d'exécution : Le plan est exécuté étape par étape
    // Note : Le mode plan n'est supporté que pour Claude (anthropic-api et claude-oauth)
    if (planMode && aiProvider !== 'gemini-cli' && aiProvider !== 'admin-gemini') {
      return this.executePlanCommand(containerId, prompt, workdir, aiProvider, model, task)
    }
    
    // Si nous avons un task, utiliser executeAndSaveToolMessages pour la sauvegarde en temps réel
    if (task) {
      return this.executeAndSaveToolMessages(containerId, prompt, workdir || '/tmp/workspace', aiProvider || 'anthropic-api', model || 'sonnet', task, 'Exécution de commande')
    }
    
    const onOutput = (data: string) => {
      // Afficher la sortie Claude en temps réel
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim() && !line.includes('===')) {
          this.logger.debug({ output: line.trim() }, '🤖 Claude output')
        }
      })
    }

    // Déterminer la commande à exécuter selon le provider
    let aiCommand = 'claude -p'
    let envSetup = ''

    // Ajouter le paramètre --model si spécifié
    const modelParam = model ? ` --model ${model}` : ''

    this.logger.debug({ aiProvider, model, hasAdminKey: !!process.env.ADMIN_GOOGLE_API_KEY }, 'AI Provider configuration')

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
        aiCommand = `gemini${modelParam} -p`
        envSetup = 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
        break
      case 'admin-gemini':
        aiCommand = `gemini${modelParam} -p`
        envSetup = `export GEMINI_API_KEY="${process.env.ADMIN_GOOGLE_API_KEY}"`
        break
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`)
    }

    const script = `
      # Create and change to working directory
      mkdir -p "${workdir || '/tmp/workspace'}"
      cd "${workdir || '/tmp/workspace'}"
      
      # Configuration Git
      git config --global user.email "open-rcode@example.com" || true
      git config --global user.name "open-rcode Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      # Charger l'environnement Node et npm global (version bash)
      [ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && source /etc/profile || true
      
      # Vérifier que Claude est installé
      which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)
      
      ${envSetup}
      ${aiCommand} "$(cat <<'PROMPT_EOF'
${prompt}
PROMPT_EOF
)"
    `

    const result = await this.executeWithStreamingBash(containerId, script, onOutput)

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    // Filtrer le chemin indésirable du début de la sortie
    let filteredOutput = result.stdout
    const unwantedPathPattern = /^\/root\/\.nvm\/versions\/node\/v[\d.]+\/bin\/claude\s*\n?/
    filteredOutput = filteredOutput.replace(unwantedPathPattern, '')
    
    // Si c'est Gemini, retourner la sortie brute sans parsing JSON
    if (aiProvider === 'gemini-cli' || aiProvider === 'admin-gemini') {
      return filteredOutput
    }
    
    // Pour Claude, parser la sortie JSON pour extraire les tool calls et les formater
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

  async executeConfigurationScript(containerId: string, configScript: string, workdir?: string): Promise<string> {
    const onOutput = (data: string) => {
      // Afficher la sortie en temps réel (sans les retours à la ligne vides)
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim()) {
          this.logger.debug({ output: line.trim() }, '📋 Config script output')
        }
      })
    }

    const script = `
      # Create and change to working directory
      mkdir -p "${workdir || '/tmp/workspace'}"
      cd "${workdir || '/tmp/workspace'}"
      
      # Configuration Git
      git config --global user.email "open-rcode@example.com" || true
      git config --global user.name "open-rcode Container" || true
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
      this.logger.error({ exitCode: result.exitCode, stderr: result.stderr }, '❌ Configuration script failed')
      throw new Error(`Configuration script failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    this.logger.info('✅ Configuration script completed successfully')
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
      git config --global user.email "open-rcode@example.com" || true
      git config --global user.name "open-rcode Container" || true
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
      this.logger.error({ exitCode: result.exitCode, stderr: result.stderr }, '❌ Configuration script failed')
      throw new Error(`Configuration script failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    this.logger.debug({ outputLength: result.stdout.length }, '✅ Configuration script completed')
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
      this.logger.info({ taskId: task._id }, 'Starting Claude workflow');

      const environment = await EnvironmentModel.findById(task.environmentId);
      if (!environment) {
        throw new Error(`Environment ${task.environmentId} not found`);
      }

      const workspaceDir = task.workspaceDir || `/tmp/workspace/${environment.repository || 'ccweb'}`;
      const aiProvider = environment.aiProvider || 'anthropic-api';
      const model = environment.model || 'sonnet';
      this.logger.info({ workspaceDir, aiProvider, model }, '🔧 Using workspace configuration');

      if (environment.configurationScript && environment.configurationScript.trim()) {
        this.logger.info('Executing configuration script');
        try {
          const configOutput = await this.executeConfigurationScript(containerId, environment.configurationScript, workspaceDir);
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `⚙️ **Configuration du projet:**\n\`\`\`\n${configOutput}\n\`\`\``
          });
          this.logger.info('Configuration script completed successfully');
        } catch (configError: any) {
          this.logger.error({ error: configError.message }, 'Configuration script failed');
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

      let finalResult = 'Tâche terminée'
      
      if (userMessage) {
        this.logger.info({ aiProvider, model, planMode: task.planMode }, 'Executing AI command with user text');
        // Créer le message initial avant de commencer l'exécution
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🚀 **Démarrage de l'exécution avec ${this.getAiProviderLabel(aiProvider)} (${model})${task.planMode ? ' en mode plan' : ''}...**`
        });
        
        // Si planMode est activé et que c'est Claude, utiliser executePlanCommand
        if (task.planMode && aiProvider !== 'gemini-cli' && aiProvider !== 'admin-gemini') {
          finalResult = await this.executePlanCommand(containerId, userMessage.content, workspaceDir, aiProvider, model, task);
        } else {
          finalResult = await this.executeAndSaveToolMessages(containerId, userMessage.content, workspaceDir, aiProvider, model, task, 'Exécution de la tâche');
        }
      }

      const prCreator = new PullRequestCreator(this.containerManager);
      await prCreator.createFromChanges(containerId, task, finalResult);

      // Créer un document CountRequest pour suivre l'utilisation
      await CountRequestModel.create({
        userId: task.userId,
        environmentId: task.environmentId,
        model: model,
        taskId: task._id
      });
      this.logger.debug({ taskId: task._id }, 'CountRequest created');

      await updateTaskStatus('completed');
      this.logger.info({ taskId: task._id }, 'Claude workflow completed');

    } catch (error: any) {
      this.logger.error({ taskId: task._id, error: error.message }, 'Error in Claude workflow');
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
      this.logger.info({ taskId: task._id, resourceType }, `Cleaning up ${resourceType}`);
      try {
        await this.containerManager.removeContainer(containerId, true);
        this.logger.info({ containerId, resourceType: resourceTypeCapitalized }, 'Resource cleaned up successfully');
        
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
        this.logger.warn({ containerId, resourceType, error: cleanupError.message }, 'Failed to cleanup resource');
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


  private getAiProviderLabel(provider: string): string {
    const labels = {
      'anthropic-api': 'Claude API',
      'claude-oauth': 'Claude Code',
      'gemini-cli': 'Gemini',
      'admin-gemini': 'Gemini Admin'
    }
    return labels[provider as keyof typeof labels] || provider
  }

  private parseClaudeJsonOutput(rawOutput: string): { toolCalls: any[], textMessages: string[], finalResult: string, totalCostUsd?: number } {
    try {
      const lines = rawOutput.split('\n')
      let toolCalls: any[] = []
      let toolResults: Map<string, any> = new Map()
      let textMessages: string[] = []
      let finalResult = ''
      let totalCostUsd: number | undefined
      
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
          } else if (jsonData.type === 'result') {
            if (jsonData.result) {
              finalResult = jsonData.result
            }
            if (jsonData.total_cost_usd) {
              totalCostUsd = jsonData.total_cost_usd
            }
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
        finalResult,
        totalCostUsd
      }
      
    } catch (error) {
      this.logger.debug({ error: error.message }, 'Error parsing Claude JSON output')
      return {
        toolCalls: [],
        textMessages: [],
        finalResult: rawOutput
      }
    }
  }

  /**
   * Exécute une commande en mode plan (deux phases : planification puis exécution)
   * 
   * Phase 1 - Planification :
   * - Claude est lancé avec --permission-mode plan
   * - Il analyse la demande et génère un plan structuré
   * - Le plan est extrait via l'outil ExitPlanMode
   * 
   * Phase 2 - Exécution :
   * - Le plan est préfixé au prompt original
   * - Claude exécute le plan sans --permission-mode
   * - Chaque action est sauvegardée en temps réel
   * 
   * @param containerId - ID du conteneur Docker/Kubernetes
   * @param prompt - Prompt utilisateur original
   * @param workdir - Répertoire de travail
   * @param aiProvider - Provider AI (anthropic-api ou claude-oauth)
   * @param model - Modèle Claude (opus ou sonnet)
   * @param task - Objet tâche pour la sauvegarde des messages
   * @returns Le résultat final de l'exécution
   */
  private async executePlanCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string, task?: any): Promise<string> {
    this.logger.info('🎯 Exécution en mode plan...')
    
    const envSetup = this.getEnvSetup(aiProvider || 'anthropic-api')
    const modelParam = model ? ` --model ${model}` : ''
    
    let planContent = ''
    let isInPlanMode = false
    let totalCostUsd: number | undefined
    
    const onPlanOutput = (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim()) {
          this.logger.debug({ output: line.trim() }, '📋 Plan output')
          
          // Essayer de parser le JSON pour détecter le mode plan et extraire le contenu
          try {
            const jsonData = JSON.parse(line.trim())
            
            // Détecter l'activation du mode plan
            // Claude envoie un message système avec permissionMode: 'plan'
            if (jsonData.type === 'system' && jsonData.permissionMode === 'plan') {
              isInPlanMode = true
              this.logger.debug('✅ Mode plan activé')
            }
            
            // Capturer le plan généré par Claude
            // L'outil ExitPlanMode contient le plan structuré dans input.plan
            if (jsonData.type === 'assistant' && jsonData.message?.content) {
              for (const content of jsonData.message.content) {
                if (content.type === 'tool_use' && content.name === 'ExitPlanMode' && content.input?.plan) {
                  planContent = content.input.plan
                  this.logger.debug('📄 Plan capturé depuis ExitPlanMode')
                }
              }
            }
            
            // Capturer le total_cost_usd du result
            if (jsonData.type === 'result' && jsonData.total_cost_usd) {
              totalCostUsd = jsonData.total_cost_usd
              this.logger.info({ costUsd: totalCostUsd }, '💰 Coût total du mode plan')
            }
          } catch (parseError) {
            // Ignorer les erreurs de parsing
          }
        }
      })
    }
    
    // Phase 1: Exécuter en mode plan
    const planScript = `
      mkdir -p "${workdir || '/tmp/workspace'}"
      cd "${workdir || '/tmp/workspace'}"
      
      git config --global user.email "open-rcode@example.com" || true
      git config --global user.name "open-rcode Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      [ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && source /etc/profile || true
      
      which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)
      
      ${envSetup}
      claude --verbose --output-format stream-json --permission-mode plan${modelParam} -p "$(cat <<'PROMPT_EOF'
${prompt}
PROMPT_EOF
)"
    `
    
    this.logger.info('🚀 Exécution de la commande en mode plan...')
    const planResult = await this.executeWithStreamingBash(containerId, planScript, onPlanOutput)
    
    if (planResult.exitCode !== 0) {
      this.logger.error({ stderr: planResult.stderr }, '❌ Échec du mode plan')
      // En cas d'échec, fallback sur le mode normal
      this.logger.info('↩️ Fallback sur le mode normal...')
      return this.executeAndSaveToolMessages(containerId, prompt, workdir || '/tmp/workspace', aiProvider || 'anthropic-api', model || 'sonnet', task, 'Exécution de commande')
    }
    
    // Si pas de plan capturé, essayer de le parser depuis la sortie
    if (!planContent && planResult.stdout) {
      const lines = planResult.stdout.split('\n')
      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line.trim())
          if (jsonData.type === 'assistant' && jsonData.message?.content) {
            for (const content of jsonData.message.content) {
              if (content.type === 'tool_use' && content.name === 'ExitPlanMode' && content.input?.plan) {
                planContent = content.input.plan
                break
              }
            }
          }
          // Capturer aussi le total_cost_usd depuis la sortie complète
          if (jsonData.type === 'result' && jsonData.total_cost_usd && !totalCostUsd) {
            totalCostUsd = jsonData.total_cost_usd
            this.logger.info({ costUsd: totalCostUsd }, '💰 Coût total du mode plan (depuis la sortie)')
          }
        } catch (e) {
          // Ignorer
        }
      }
    }
    
    if (!planContent) {
      this.logger.warn('⚠️ Aucun plan trouvé, exécution directe du prompt...')
      return this.executeAndSaveToolMessages(containerId, prompt, workdir || '/tmp/workspace', aiProvider || 'anthropic-api', model || 'sonnet', task, 'Exécution de commande')
    }
    
    // Si on a un task, sauvegarder le plan et le coût
    if (task) {
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `📋 **Plan d'exécution:**\n\n${planContent}`
      })
      
      // Sauvegarder le coût du mode plan si disponible
      if (totalCostUsd) {
        try {
          await UserCostModel.create({
            environmentId: task.environmentId,
            userId: task.userId,
            taskId: task._id,
            costUsd: totalCostUsd,
            model: model === 'claude-sonnet-4' ? 'sonnet' : model || 'sonnet',
            aiProvider: aiProvider || 'anthropic-api'
          })
          this.logger.info({ costUsd: totalCostUsd, taskId: task._id }, '💰 UserCost du mode plan sauvegardé')
        } catch (costError) {
          this.logger.error({ error: costError }, 'Erreur lors de la création du document UserCost pour le mode plan')
        }
      }
    }
    
    // Phase 2: Exécuter le plan
    // Le plan est préfixé au prompt original pour guider l'exécution
    // Claude exécutera les étapes du plan une par une avec tous les outils disponibles
    this.logger.info('🏃 Exécution du plan...')
    const executionPrompt = `Voici le plan à exécuter :\n\n${planContent}\n\n${prompt}`
    
    return this.executeAndSaveToolMessages(containerId, executionPrompt, workdir || '/tmp/workspace', aiProvider || 'anthropic-api', model || 'sonnet', task, 'Exécution du plan')
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
    
    const aiProviderLabel = this.getAiProviderLabel(aiProvider)
    let streamBuffer = ''
    let processedToolCallIds = new Set<string>()
    
    // Fonction pour traiter les messages en temps réel
    const processStreamingOutput = async (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        if (line.trim() && !line.includes('===')) {
          this.logger.debug({ provider: (aiProvider === 'gemini-cli' || aiProvider === 'admin-gemini') ? 'Gemini' : 'Claude', output: line.trim() }, '🤖 AI output')
          
          // Ajouter la ligne au buffer
          streamBuffer += line + '\n'
          
          // Pour Gemini, sauvegarder la sortie brute au fur et à mesure
          if (aiProvider === 'gemini-cli' || aiProvider === 'admin-gemini') {
            // Ne pas essayer de parser JSON pour Gemini
            continue
          }
          
          // Pour Claude, essayer de parser les lignes JSON complètes
          try {
            const jsonData = JSON.parse(line.trim())
            
            // Traiter les tool calls en temps réel
            if (jsonData.type === 'assistant' && jsonData.message?.content) {
              for (const content of jsonData.message.content) {
                if (content.type === 'tool_use' && !processedToolCallIds.has(content.id)) {
                  processedToolCallIds.add(content.id)
                  
                  // Créer un message immédiatement pour ce tool call
                  const toolCall = {
                    id: content.id,
                    name: content.name,
                    input: content.input
                  }
                  
                  const toolContent = this.formatToolCall(toolCall)
                  await TaskMessageModel.create({
                    id: uuidv4(),
                    userId: task.userId,
                    taskId: task._id,
                    role: 'assistant',
                    content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n${toolContent}`
                  })
                  
                  this.logger.debug({ toolName: content.name }, '💾 Tool call saved in real-time')
                }
              }
            }
          } catch (parseError) {
            // Ignorer les erreurs de parsing, la ligne n'est peut-être pas du JSON
          }
        }
      }
    }
    
    // Exécuter la commande Claude avec le callback de streaming
    const result = await this.executeWithStreamingBash(containerId, `
      # Create and change to working directory
      mkdir -p "${workdir}"
      cd "${workdir}"
      
      # Configuration Git
      git config --global user.email "open-rcode@example.com" || true
      git config --global user.name "open-rcode Container" || true
      git config --global init.defaultBranch main || true
      git config --global --add safe.directory "${workdir}" || true
      
      # Charger l'environnement Node et npm global (version bash)
      [ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && source /etc/profile || true
      
      # Vérifier que Claude est installé
      which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)
      which gemini || (echo "Gemini not found in PATH. Installing..." && npm install -g @google/gemini-cli)
      
      ${this.getEnvSetup(aiProvider)}
      ${this.getAiCommand(aiProvider, model)} "$(cat <<'PROMPT_EOF'
${prompt}
PROMPT_EOF
)"
    `, processStreamingOutput)

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    // Filtrer le chemin indésirable
    let filteredOutput = result.stdout
    const unwantedPathPattern = /^\/root\/\.nvm\/versions\/node\/v[\d.]+\/bin\/claude\s*\n?/
    filteredOutput = filteredOutput.replace(unwantedPathPattern, '')
    
    // Si c'est Gemini, gérer différemment
    if (aiProvider === 'gemini-cli' || aiProvider === 'admin-gemini') {
      // Créer un message avec la sortie brute de Gemini
      if (filteredOutput.trim()) {
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n${filteredOutput}`
        })
      }
      
      // Retourner la sortie pour la création de PR
      return filteredOutput || 'Tâche terminée'
    }
    
    // Pour Claude, parser la sortie JSON complète pour les éléments finaux
    const parsedOutput = this.parseClaudeJsonOutput(filteredOutput)
    
    // Créer un document UserCost si total_cost_usd est disponible
    if (parsedOutput.totalCostUsd) {
      try {
        await UserCostModel.create({
          environmentId: task.environmentId,
          userId: task.userId,
          taskId: task._id,
          costUsd: parsedOutput.totalCostUsd,
          model: model === 'claude-sonnet-4' ? 'sonnet' : model,
          aiProvider: aiProvider
        })
        this.logger.info({ costUsd: parsedOutput.totalCostUsd, taskId: task._id }, 'UserCost created')
      } catch (costError) {
        this.logger.error({ error: costError }, 'Error creating UserCost document')
      }
    }
    
    // Traiter les tool calls qui n'ont pas été traités en temps réel (avec résultats)
    for (const toolCall of parsedOutput.toolCalls) {
      if (!processedToolCallIds.has(toolCall.id) && toolCall.result) {
        const toolContent = this.formatToolCall(toolCall)
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n${toolContent}`
        })
      }
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
      case 'admin-gemini':
        return `export GEMINI_API_KEY="${process.env.ADMIN_GOOGLE_API_KEY}"`
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`)
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
        return `gemini${modelParam} -p`
      case 'admin-gemini':
        return `gemini${modelParam} -p`
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`)
    }
  }
}