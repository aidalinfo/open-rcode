import { BaseContainerManager } from './container/base-container-manager'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { PullRequestCreator } from './pull-request-creator'
import { TaskMessageModel } from '../models/TaskMessage'
import { CountRequestModel } from '../models/CountRequest'
import { UserCostModel } from '../models/UserCost'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from './logger'
import { AIProviderAdapter } from './ai-providers/ai-provider-adapter'
import { AIProviderType, ParsedOutput } from './ai-providers/base-ai-provider'
import { ContainerScripts } from './container-scripts'
import { AIProviderFactory } from './ai-providers/ai-provider-factory'

interface ExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
}

export class ClaudeExecutor {
  private containerManager: BaseContainerManager
  private logger = createLogger('ClaudeExecutor')

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  async executeCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string, task?: any, planMode?: boolean): Promise<string> {
    const providerType = (aiProvider || 'anthropic-api') as AIProviderType
    const adapter = new AIProviderAdapter(providerType)
    
    // Si nous sommes en mode plan avec Claude, utiliser executePlanCommand
    if (planMode && adapter.supportsPlanMode()) {
      return this.executePlanCommand(containerId, prompt, workdir, providerType, model, task)
    }
    
    // Si nous avons un task, utiliser executeAndSaveToolMessages pour la sauvegarde en temps réel
    if (task) {
      return this.executeAndSaveToolMessages(containerId, prompt, workdir || '/tmp/workspace', providerType, model || 'sonnet', task, 'Exécution de commande')
    }
    
    const onOutput = (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim() && !line.includes('===')) {
          this.logger.debug({ output: line.trim() }, '🤖 AI output')
        }
      })
    }

    this.logger.debug({ aiProvider: providerType, model, hasAdminKey: !!process.env.ADMIN_GOOGLE_API_KEY }, 'AI Provider configuration')

    const script = adapter.buildExecutionScript({
      prompt,
      workdir: workdir || '/tmp/workspace',
      model,
      planMode
    })

    const result = await this.executeWithStreamingBash(containerId, script, onOutput)

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    const parsedOutput = adapter.parseOutput(result.stdout)
    
    // Si c'est Gemini, retourner le résultat final directement
    if (AIProviderFactory.isGeminiProvider(providerType)) {
      return parsedOutput.finalResult
    }
    
    // Pour Claude, formater la sortie
    const formattedParts: string[] = []
    
    for (const toolCall of parsedOutput.toolCalls) {
      formattedParts.push(adapter.formatToolCall(toolCall))
    }
    
    if (parsedOutput.textMessages.length > 0) {
      formattedParts.push('\n💬 **Réponse:**')
      formattedParts.push(parsedOutput.textMessages.join('\n'))
    }
    
    if (parsedOutput.finalResult && !parsedOutput.textMessages.includes(parsedOutput.finalResult)) {
      formattedParts.push('\n📋 **Résumé:**')
      formattedParts.push(parsedOutput.finalResult)
    }
    
    return formattedParts.length > 0 ? formattedParts.join('\n\n') : parsedOutput.finalResult
  }

  async executeConfigurationScript(containerId: string, configScript: string, workdir?: string): Promise<string> {
    const onOutput = (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach(line => {
        if (line.trim()) {
          this.logger.debug({ output: line.trim() }, '📋 Config script output')
        }
      })
    }

    const script = ContainerScripts.buildConfigurationScript(
      workdir || '/tmp/workspace',
      configScript
    )

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

      const workspaceDir = task.workspaceDir || `/tmp/workspace/${environment.repository || 'openrcode'}`;
      const aiProvider = (environment.aiProvider || 'anthropic-api') as AIProviderType
      const model = environment.model || 'sonnet'
      this.logger.info({ workspaceDir, aiProvider, model }, '🔧 Using workspace configuration')

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
        
        const adapter = new AIProviderAdapter(aiProvider)
        
        // Si planMode est activé et que le provider le supporte
        if (task.planMode && adapter.supportsPlanMode()) {
          finalResult = await this.executePlanCommand(containerId, userMessage.content, workspaceDir, aiProvider, model, task)
        } else {
          finalResult = await this.executeAndSaveToolMessages(containerId, userMessage.content, workspaceDir, aiProvider, model, task, 'Exécution de la tâche')
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


  private getAiProviderLabel(provider: AIProviderType): string {
    const adapter = new AIProviderAdapter(provider)
    return adapter.getName()
  }

  private parseClaudeJsonOutput(rawOutput: string): ParsedOutput {
    const adapter = new AIProviderAdapter('anthropic-api')
    return adapter.parseOutput(rawOutput)
  }

  private async executePlanCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: AIProviderType, model?: string, task?: any): Promise<string> {
    this.logger.info('🎯 Exécution en mode plan...')
    
    const providerType = aiProvider || 'anthropic-api'
    const adapter = new AIProviderAdapter(providerType)
    
    let planContent = ''
    let isInPlanMode = false
    let totalCostUsd: number | undefined
    let processedToolCallIds = new Set<string>()
    
    const onPlanOutput = async (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      for (const line of lines) {
        if (line.trim()) {
          this.logger.debug({ output: line.trim() }, '📋 Plan output')
          
          // Essayer de parser le JSON pour détecter le mode plan et extraire le contenu
          try {
            const jsonData = JSON.parse(line.trim())
            
            // Détecter si on est en mode plan
            if (jsonData.type === 'system' && jsonData.permissionMode === 'plan') {
              isInPlanMode = true
              this.logger.debug('✅ Mode plan activé')
            }
            
            // Traiter tous les tool calls (pas seulement ExitPlanMode)
            if (jsonData.type === 'assistant' && jsonData.message?.content) {
              for (const content of jsonData.message.content) {
                if (content.type === 'tool_use' && !processedToolCallIds.has(content.id)) {
                  processedToolCallIds.add(content.id)
                  
                  // Sauvegarder tous les tools, pas seulement ExitPlanMode
                  const toolCall = {
                    id: content.id,
                    name: content.name,
                    input: content.input
                  }
                  
                  // Si c'est ExitPlanMode, capturer aussi le plan
                  if (content.name === 'ExitPlanMode' && content.input?.plan) {
                    planContent = content.input.plan
                    this.logger.debug('📄 Plan capturé depuis ExitPlanMode')
                  }
                  
                  // Sauvegarder le tool call dans la DB
                  if (task) {
                    const toolContent = adapter.formatToolCall(toolCall)
                    await TaskMessageModel.create({
                      id: uuidv4(),
                      userId: task.userId,
                      taskId: task._id,
                      role: 'assistant',
                      content: `🤖 **${adapter.getName()} (${model}) - Mode Plan:**\n\n${toolContent}`
                    })
                    
                    this.logger.debug({ toolName: content.name }, '💾 Tool call saved in plan mode')
                  }
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
      }
    }
    
    // Phase 1: Exécuter en mode plan
    const planScript = adapter.buildExecutionScript({
      prompt,
      workdir: workdir || '/tmp/workspace',
      model,
      planMode: true
    })
    
    this.logger.info('🚀 Exécution de la commande en mode plan...')
    const planResult = await this.executeWithStreamingBash(containerId, planScript, onPlanOutput)
    
    if (planResult.exitCode !== 0) {
      this.logger.error({ stderr: planResult.stderr }, '❌ Échec du mode plan')
      // En cas d'échec, fallback sur le mode normal
      this.logger.info('↩️ Fallback sur le mode normal...')
      return this.executeAndSaveToolMessages(containerId, prompt, workdir || '/tmp/workspace', providerType, model || 'sonnet', task, 'Exécution de commande')
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
      return this.executeAndSaveToolMessages(containerId, prompt, workdir || '/tmp/workspace', providerType, model || 'sonnet', task, 'Exécution de commande')
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
            aiProvider: providerType
          })
          this.logger.info({ costUsd: totalCostUsd, taskId: task._id }, '💰 UserCost du mode plan sauvegardé')
        } catch (costError) {
          this.logger.error({ error: costError }, 'Erreur lors de la création du document UserCost pour le mode plan')
        }
      }
    }
    
    // Phase 2: Exécuter le plan
    this.logger.info('🏃 Exécution du plan...')
    const executionPrompt = `Voici le plan à exécuter :\n\n${planContent}\n\n${prompt}`
    
    return this.executeAndSaveToolMessages(containerId, executionPrompt, workdir || '/tmp/workspace', providerType, model || 'sonnet', task, 'Exécution du plan')
  }

  private formatToolCall(toolCall: any): string {
    const adapter = new AIProviderAdapter('anthropic-api')
    return adapter.formatToolCall(toolCall)
  }

  async executeAndSaveToolMessages(
    containerId: string, 
    prompt: string, 
    workdir: string, 
    aiProvider: AIProviderType, 
    model: string, 
    task: any, 
    actionLabel: string
  ): Promise<string> {
    
    const adapter = new AIProviderAdapter(aiProvider)
    const aiProviderLabel = adapter.getName()
    let streamBuffer = ''
    let processedToolCallIds = new Set<string>()
    
    // Fonction pour traiter les messages en temps réel
    const processStreamingOutput = async (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        if (line.trim() && !line.includes('===')) {
          this.logger.debug({ provider: AIProviderFactory.isGeminiProvider(aiProvider) ? 'Gemini' : 'Claude', output: line.trim() }, '🤖 AI output')
          
          // Ajouter la ligne au buffer
          streamBuffer += line + '\n'
          
          // Pour Gemini, sauvegarder la sortie brute au fur et à mesure
          if (AIProviderFactory.isGeminiProvider(aiProvider)) {
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
    
    // Exécuter la commande AI avec le callback de streaming
    const script = adapter.buildExecutionScript({
      prompt,
      workdir,
      model,
      planMode: false
    })

    const result = await this.executeWithStreamingBash(containerId, script, processStreamingOutput)

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    const parsedOutput = adapter.parseOutput(result.stdout)
    
    // Si c'est Gemini, gérer différemment
    if (AIProviderFactory.isGeminiProvider(aiProvider)) {
      // Créer un message avec la sortie brute de Gemini
      if (parsedOutput.finalResult.trim()) {
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n${parsedOutput.finalResult}`
        })
      }
      
      // Retourner la sortie pour la création de PR
      return parsedOutput.finalResult || 'Tâche terminée'
    }
    
    // Pour Claude, traiter les résultats complets
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