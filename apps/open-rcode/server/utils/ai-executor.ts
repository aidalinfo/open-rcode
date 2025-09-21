import type { BaseContainerManager } from './container/base-container-manager'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { SubAgentModel } from '../models/SubAgent'
import { PullRequestCreator } from './pull-request-creator'
import { TaskMessageModel } from '../models/TaskMessage'
import { CountRequestModel } from '../models/CountRequest'
import { UserCostModel } from '../models/UserCost'
import { McpModel } from '../models/Mcp'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from './logger'
import { AIProviderAdapter } from './ai-providers/ai-provider-adapter'
import type { AIProviderType, McpServerConfig, ParsedOutput } from './ai-providers/base-ai-provider'
import { ContainerScripts } from './container-scripts'
import { AIProviderFactory } from './ai-providers/ai-provider-factory'

interface ExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
}

export class AIExecutor {
  private containerManager: BaseContainerManager
  private logger = createLogger('AIExecutor')

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  private normalizeIdList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined

    const seen = new Set<string>()
    const ids: string[] = []

    for (const entry of value) {
      if (entry === undefined || entry === null) continue
      if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'bigint') {
        continue
      }
      const str = typeof entry === 'string' ? entry.trim() : String(entry).trim()
      if (!str) continue
      if (seen.has(str)) continue
      seen.add(str)
      ids.push(str)
    }

    return ids.length ? ids : undefined
  }

  private extractSelectedMcpIds(task: any): string[] | undefined {
    if (!task || typeof task !== 'object') return undefined

    const candidates: unknown[] = [
      (task as any).selectedMcpIds,
      (task as any).mcpServerIds
    ]

    if (task.aiConfig && typeof task.aiConfig === 'object') {
      const cfg = task.aiConfig as Record<string, unknown>
      candidates.push(cfg.selectedMcpIds)
      candidates.push(cfg.mcpServerIds)
    }

    for (const candidate of candidates) {
      const normalized = this.normalizeIdList(candidate)
      if (normalized && normalized.length > 0) {
        return normalized
      }
    }

    return undefined
  }

  private async resolveSelectedMcpServers(providerType: AIProviderType, task?: any): Promise<McpServerConfig[] | undefined> {
    if (!task || !AIProviderFactory.isCodexProvider(providerType)) return undefined
    const userId = task.userId
    if (!userId) return undefined

    const ids = this.extractSelectedMcpIds(task)
    if (!ids || ids.length === 0) return undefined

    try {
      const documents = await McpModel.find({
        userId,
        _id: { $in: ids }
      }).lean()

      if (!documents || documents.length === 0) {
        return undefined
      }

      const byId = new Map<string, any>()
      for (const doc of documents) {
        const docId = doc?._id ? String(doc._id) : undefined
        if (!docId) continue
        byId.set(docId, doc)
      }

      const servers: McpServerConfig[] = []
      for (const id of ids) {
        const doc = byId.get(id)
        if (!doc) continue

        const command = typeof doc.command === 'string' && doc.command.trim() ? doc.command.trim() : undefined
        const args = Array.isArray(doc.args)
          ? doc.args
              .map((arg: unknown) => (typeof arg === 'string' ? arg : (arg === undefined || arg === null ? '' : String(arg))))
              .map((arg: string) => arg.trim())
              .filter((arg: string) => arg.length > 0)
          : undefined

        const server: McpServerConfig = {
          id,
          name: typeof doc.name === 'string' ? doc.name : id,
          type: doc.type === 'sse' ? 'sse' : 'stdio',
          command,
          args: args && args.length > 0 ? args : undefined,
          url: typeof doc.url === 'string' && doc.url.trim() ? doc.url.trim() : undefined
        }

        servers.push(server)
      }

      return servers.length ? servers : undefined
    } catch (error) {
      this.logger.debug({ error }, 'Failed to resolve MCP servers for Codex provider')
      return undefined
    }
  }

  private applyMcpPromptHint(prompt: string, servers?: McpServerConfig[]): string {
    if (!prompt || !servers || servers.length === 0) {
      return prompt
    }

    const uniqueNames = Array.from(
      new Set(
        servers
          .map(server => (server.name && server.name.trim()) || server.id)
          .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
          .map(name => name.trim())
      )
    )

    if (uniqueNames.length === 0) {
      return prompt
    }

    const label = uniqueNames.length > 1 ? 'servers' : 'server'
    const list = uniqueNames.join(', ')
    const hint = `For this task, please leverage the following MCP ${label} whenever helpful: ${list}.`

    return `${hint}\n\n${prompt}`
  }

  private getProviderConfigOverrides(aiProvider: AIProviderType | string, environment?: any, task?: any): Record<string, any> | undefined {
    try {
      // Only handle Codex for now
      if (!AIProviderFactory.isCodexProvider(aiProvider as any)) return undefined

      const overrides: Record<string, any> = {}

      // Environment-level via environmentVariables (DB)
      if (environment && Array.isArray(environment.environmentVariables)) {
        const map: Record<string, string> = {}
        for (const v of environment.environmentVariables) {
          if (v && v.key) map[v.key] = v.value
        }
        // Preferred key for reasoning effort
        const eff = map['CODEX_MODEL_REASONING_EFFORT'] || map['MODEL_REASONING_EFFORT'] || map['CODEX_REASONING_EFFORT']
        if (eff) overrides['model_reasoning_effort'] = eff
      }

      // Request-level via task.aiConfig
      if (task && task.aiConfig && typeof task.aiConfig === 'object') {
        if (task.aiConfig.model_reasoning_effort) {
          overrides['model_reasoning_effort'] = task.aiConfig.model_reasoning_effort
        }
      }

      return Object.keys(overrides).length ? overrides : undefined
    } catch {
      return undefined
    }
  }

  private sanitizeModel(aiProvider: AIProviderType | string, model?: string): string | undefined {
    if (!model) return undefined
    if (AIProviderFactory.isCodexProvider(aiProvider as any)) {
      const m = model.trim().toLowerCase()
      const looksCodex = /^(o3|o4|gpt-5|codex-)/.test(m)
      return looksCodex ? model : undefined
    }
    return model
  }

  async executeCommand(containerId: string, prompt: string, workdir?: string, aiProvider?: string, model?: string, task?: any, planMode?: boolean): Promise<string> {
    const providerType = (aiProvider || 'anthropic-api') as AIProviderType
    const adapter = new AIProviderAdapter(providerType)
    const actualWorkdir = workdir || '/tmp/workspace'

    // Détecter la présence d'un fichier MCP config
    const mcpConfigPath = await this.detectMcpConfig(containerId, actualWorkdir)
    const selectedMcpServers = await this.resolveSelectedMcpServers(providerType, task)
    const promptWithMcpHint = this.applyMcpPromptHint(prompt, selectedMcpServers)

    // Si nous sommes en mode plan avec Claude, utiliser executePlanCommand
    if (planMode && adapter.supportsPlanMode()) {
      return this.executePlanCommand(containerId, promptWithMcpHint, actualWorkdir, providerType, model, task, mcpConfigPath, selectedMcpServers)
    }

    // Si nous avons un task, utiliser executeAndSaveToolMessages pour la sauvegarde en temps réel
    if (task) {
      return this.executeAndSaveToolMessages(
        containerId,
        promptWithMcpHint,
        actualWorkdir,
        providerType,
        model || 'sonnet',
        task,
        'Exécution de commande',
        mcpConfigPath,
        this.getProviderConfigOverrides(providerType),
        selectedMcpServers
      )
    }

    const onOutput = (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())
      lines.forEach((line) => {
        if (line.trim() && !line.includes('===')) {
          this.logger.debug({ output: line.trim() }, '🤖 AI output')
        }
      })
    }

    this.logger.debug({ aiProvider: providerType, model, hasAdminKey: !!process.env.ADMIN_GOOGLE_API_KEY }, 'AI Provider configuration')

    const script = adapter.buildExecutionScript({
      prompt: promptWithMcpHint,
      workdir: actualWorkdir,
      model: this.sanitizeModel(providerType, model),
      planMode,
      mcpConfigPath,
      configOverrides: this.getProviderConfigOverrides(providerType),
      selectedMcpServers
    })

    // Streaming pour Claude/Codex; pas de streaming pour Gemini
    let result: ExecuteResult
    if (AIProviderFactory.isClaudeProvider(providerType) || AIProviderFactory.isCodexProvider(providerType)) {
      result = await this.executeWithStreamingBash(containerId, script, onOutput)
    } else {
      result = await this.containerManager.executeInContainer({
        containerId,
        command: ['/bin/bash', '-c', script],
        user: 'root',
        environment: { HOME: '/root' }
      })
    }

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    const parsedOutput = adapter.parseOutput(result.stdout)

    // Si c'est Gemini, retourner le résultat final directement
    if (AIProviderFactory.isGeminiProvider(providerType) || AIProviderFactory.isCodexProvider(providerType)) {
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
      lines.forEach((line) => {
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
          environment: { HOME: '/root' }
        }, onOutput)
      }
    }

    // Fallback pour Docker (pas de streaming)
    return this.containerManager.executeInContainer({
      containerId,
      command: ['sh', '-c', script],
      user: 'root',
      environment: { HOME: '/root' }
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
          environment: { HOME: '/root' }
        }, onOutput)
      }
    }

    // Fallback pour Docker (pas de streaming)
    return this.containerManager.executeInContainer({
      containerId,
      command: ['/bin/bash', '-c', script],
      user: 'root',
      environment: { HOME: '/root' }
    })
  }

  private async detectMcpConfig(containerId: string, workdir: string): Promise<string | undefined> {
    try {
      // Check for .mcp.json first, then servers.json
      const checkScript = `
        if [ -f "${workdir}/.mcp.json" ]; then
          echo "${workdir}/.mcp.json"
        elif [ -f "${workdir}/servers.json" ]; then
          echo "${workdir}/servers.json"
        fi
      `
      
      const result = await this.containerManager.executeInContainer({
        containerId,
        command: ['sh', '-c', checkScript],
        user: 'root'
      })

      if (result.stdout && result.stdout.trim()) {
        const configPath = result.stdout.trim()
        this.logger.info({ configPath }, '🔌 MCP config file detected')
        return configPath
      }
    } catch (error) {
      this.logger.debug({ error }, 'Error detecting MCP config')
    }
    
    return undefined
  }

  async executeWorkflow(containerId: string, task: any): Promise<void> {
    const updateTaskStatus = async (status: string, error?: string) => {
      await TaskModel.findByIdAndUpdate(task._id, {
        status,
        error: error || null,
        updatedAt: new Date()
      })
    }

    try {
      await updateTaskStatus('running')
      this.logger.info({ taskId: task._id }, 'Starting Claude workflow')

      const environment = await EnvironmentModel.findById(task.environmentId)
      if (!environment) {
        throw new Error(`Environment ${task.environmentId} not found`)
      }

      const workspaceDir = task.workspaceDir || `/tmp/workspace/${environment.repository || 'openrcode'}`
      const aiProvider = (environment.aiProvider || 'anthropic-api') as AIProviderType
      const model = environment.model || 'sonnet'
      this.logger.info({ workspaceDir, aiProvider, model }, '🔧 Using workspace configuration')

      // Détecter la présence d'un fichier MCP config
      const mcpConfigPath = await this.detectMcpConfig(containerId, workspaceDir)
      const selectedMcpServers = await this.resolveSelectedMcpServers(aiProvider, task)

      // Créer les fichiers de SubAgents si l'environnement en a
      if (environment.subAgents && environment.subAgents.length > 0) {
        this.logger.info({ subAgentCount: environment.subAgents.length }, '🤖 Setting up SubAgents for Claude Code')
        try {
          await this.setupSubAgents(containerId, environment, task)
        } catch (subAgentError: any) {
          this.logger.error({ error: subAgentError.message }, 'SubAgent setup failed')
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `⚠️ **Avertissement lors de la configuration des SubAgents:**\n\`\`\`\n${subAgentError.message}\n\`\`\``
          })
          // Ne pas arrêter l'exécution, juste continuer sans SubAgents
        }
      }

      if (environment.configurationScript && environment.configurationScript.trim()) {
        this.logger.info('Executing configuration script')
        try {
          const configOutput = await this.executeConfigurationScript(containerId, environment.configurationScript, workspaceDir)
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `⚙️ **Configuration du projet:**\n\`\`\`\n${configOutput}\n\`\`\``
          })
          this.logger.info('Configuration script completed successfully')
        } catch (configError: any) {
          this.logger.error({ error: configError.message }, 'Configuration script failed')
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: `❌ **Erreur lors de la configuration:**\n\`\`\`\n${configError.message}\n\`\`\``
          })
          await updateTaskStatus('failed', configError.message)
          return
        }
      }

      const userMessage = await TaskMessageModel.findOne({ taskId: task._id, role: 'user' }).sort({ createdAt: 1 })

      let finalResult = 'Tâche terminée'

      if (userMessage) {
        this.logger.info({ aiProvider, model, planMode: task.planMode }, 'Executing AI command with user text')
        // Créer le message initial avant de commencer l'exécution
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🚀 **Démarrage de l'exécution avec ${this.getExecutionLabel(aiProvider, model)}${task.planMode ? ' en mode plan' : ''}...**`
        })

        const adapter = new AIProviderAdapter(aiProvider)
        const promptWithMcpHint = this.applyMcpPromptHint(userMessage.content, selectedMcpServers)

        // Si planMode est activé et que le provider le supporte
        if (task.planMode && adapter.supportsPlanMode()) {
          finalResult = await this.executePlanCommand(containerId, promptWithMcpHint, workspaceDir, aiProvider, model, task, mcpConfigPath, selectedMcpServers)
        } else {
          finalResult = await this.executeAndSaveToolMessages(
            containerId,
            promptWithMcpHint,
            workspaceDir,
            aiProvider,
            model,
            task,
            'Exécution de la tâche',
            mcpConfigPath,
            this.getProviderConfigOverrides(aiProvider, environment, task),
            selectedMcpServers
          )
        }
      }

      const prCreator = new PullRequestCreator(this.containerManager)
      await prCreator.createFromChanges(containerId, task, finalResult)

      // Créer un document CountRequest pour suivre l'utilisation
      await CountRequestModel.create({
        userId: task.userId,
        environmentId: task.environmentId,
        model: model,
        taskId: task._id
      })
      this.logger.debug({ taskId: task._id }, 'CountRequest created')

      await updateTaskStatus('completed')
      this.logger.info({ taskId: task._id }, 'Claude workflow completed')
    } catch (error: any) {
      this.logger.error({ taskId: task._id, error: error.message }, 'Error in Claude workflow')
      await updateTaskStatus('failed', error.message)
      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `❌ **Erreur dans le workflow Claude:** ${error.message}`
      })
    } finally {
      // Détecter si on utilise Kubernetes
      const isKubernetes = this.containerManager.constructor.name === 'KubernetesAdapter'
      const resourceType = isKubernetes ? 'pod' : 'conteneur'
      const resourceTypeCapitalized = isKubernetes ? 'Pod' : 'Conteneur Docker'

      // Nettoyer le conteneur/pod après l'exécution (succès ou échec)
      this.logger.info({ taskId: task._id, resourceType }, `Cleaning up ${resourceType}`)
      try {
        await this.containerManager.removeContainer(containerId, true)
        this.logger.info({ containerId, resourceType: resourceTypeCapitalized }, 'Resource cleaned up successfully')

        // Supprimer la référence du conteneur de la tâche
        await TaskModel.findByIdAndUpdate(task._id, { dockerId: null })

        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🧹 **Nettoyage automatique:** Le ${resourceType} a été supprimé après l'exécution de la tâche.`
        })
      } catch (cleanupError: any) {
        this.logger.warn({ containerId, resourceType, error: cleanupError.message }, 'Failed to cleanup resource')
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `⚠️ **Attention:** Échec du nettoyage automatique du ${resourceType}. Le ${resourceType} devra être supprimé manuellement.`
        })
      }
    }
  }

  private getAiProviderLabel(provider: AIProviderType): string {
    const adapter = new AIProviderAdapter(provider)
    return adapter.getName()
  }

  private getExecutionLabel(aiProvider: AIProviderType, model?: string): string {
    const adapter = new AIProviderAdapter(aiProvider)
    const providerName = adapter.getName()
    
    // Pour Codex, afficher "Codex (GPT-5)" au lieu du model fourni
    if (AIProviderFactory.isCodexProvider(aiProvider)) {
      return `${providerName} (GPT-5)`
    }
    
    // Pour les autres providers, garder le comportement habituel
    return `${providerName} (${model || 'default'})`
  }

  private parseClaudeJsonOutput(rawOutput: string): ParsedOutput {
    const adapter = new AIProviderAdapter('anthropic-api')
    return adapter.parseOutput(rawOutput)
  }

  private async executePlanCommand(
    containerId: string,
    prompt: string,
    workdir?: string,
    aiProvider?: AIProviderType,
    model?: string,
    task?: any,
    mcpConfigPath?: string,
    selectedMcpServers?: McpServerConfig[]
  ): Promise<string> {
    this.logger.info('🎯 Exécution en mode plan...')

    const providerType = aiProvider || 'anthropic-api'
    const adapter = new AIProviderAdapter(providerType)

    let planContent = ''
    let isInPlanMode = false
    let totalCostUsd: number | undefined
    const processedToolCallIds = new Set<string>()

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
      model: this.sanitizeModel(providerType, model),
      planMode: true,
      mcpConfigPath,
      configOverrides: this.getProviderConfigOverrides(providerType, environment, task),
      selectedMcpServers
    })

    this.logger.info('🚀 Exécution de la commande en mode plan...')
    let planResult: ExecuteResult
    if (AIProviderFactory.isClaudeProvider(providerType) || AIProviderFactory.isCodexProvider(providerType)) {
      planResult = await this.executeWithStreamingBash(containerId, planScript, onPlanOutput)
    } else {
      planResult = await this.containerManager.executeInContainer({
        containerId,
        command: ['/bin/bash', '-c', planScript],
        user: 'root',
        environment: { HOME: '/root' }
      })
    }

    if (planResult.exitCode !== 0) {
      this.logger.error({ stderr: planResult.stderr }, '❌ Échec du mode plan')
      // En cas d'échec, fallback sur le mode normal
      this.logger.info('↩️ Fallback sur le mode normal...')
      return this.executeAndSaveToolMessages(
        containerId,
        prompt,
        workdir || '/tmp/workspace',
        providerType,
        model || 'sonnet',
        task,
        'Exécution de commande',
        mcpConfigPath,
        this.getProviderConfigOverrides(providerType, environment, task),
        selectedMcpServers
      )
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
      return this.executeAndSaveToolMessages(
        containerId,
        prompt,
        workdir || '/tmp/workspace',
        providerType,
        model || 'sonnet',
        task,
        'Exécution de commande',
        mcpConfigPath,
        this.getProviderConfigOverrides(providerType, environment, task),
        selectedMcpServers
      )
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

    return this.executeAndSaveToolMessages(
      containerId,
      executionPrompt,
      workdir || '/tmp/workspace',
      providerType,
      this.sanitizeModel(providerType, model || 'sonnet') || (model || 'sonnet'),
      task,
      'Exécution du plan',
      mcpConfigPath,
      this.getProviderConfigOverrides(providerType, environment, task),
      selectedMcpServers
    )
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
    actionLabel: string,
    mcpConfigPath?: string,
    configOverrides?: Record<string, any>,
    selectedMcpServers?: McpServerConfig[]
  ): Promise<string> {
    const adapter = new AIProviderAdapter(aiProvider)
    const aiProviderLabel = adapter.getName()
    let streamBuffer = ''
    const processedToolCallIds = new Set<string>()
    const isCodex = AIProviderFactory.isCodexProvider(aiProvider)

    // Codex incremental streaming state
    const codexTsLine = /^\[[0-9]{4}-[0-9]{2}-[0-9]{2}T[^\]]+\]\s*(.*)$/
    let codexCurrentKind: 'assistant' | 'tool' | 'diff' | 'system' | 'note' | null = null
    let codexBuffer: string[] = []
    let codexChunksSaved = 0
    let codexLastAssistantText = ''

    const codexFlush = async () => {
      if (!codexCurrentKind || codexBuffer.length === 0) return
      const content = codexBuffer.join('\n').trim()
      codexBuffer = []
      if (!content) { codexCurrentKind = null; return }

      // Skip certain notes
      if (codexCurrentKind === 'note') {
        if (/^tokens used:/i.test(content)) { codexCurrentKind = null; return }
        if (/^User instructions:/i.test(content)) { codexCurrentKind = null; return }
      }

      let message: string
      switch (codexCurrentKind) {
        case 'system':
          message = `🟢 **${aiProviderLabel} (${model}) démarré**\n\n\`\`\`\n${content}\n\`\`\``
          break
        case 'tool':
          message = `🔧 **apply_patch**\n\n\`\`\`diff\n${content}\n\`\`\``
          break
        case 'diff':
          message = `🔧 **turn diff**\n\n\`\`\`diff\n${content}\n\`\`\``
          break
        case 'note':
          message = `📝 ${content}`
          break
        case 'assistant':
        default:
          message = content
          codexLastAssistantText = content
          break
      }

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: message
      })
      codexChunksSaved++
      codexCurrentKind = null
    }

    const codexStart = async (kind: typeof codexCurrentKind, initial?: string) => {
      await codexFlush()
      codexCurrentKind = kind
      codexBuffer = []
      if (initial) codexBuffer.push(initial)
    }

    // For Codex OAuth, show a one-time credentials hint if not configured
    if (aiProvider === 'codex-oauth') {
      try {
        const check = await this.containerManager.executeInContainer({
          containerId,
          // Avoid false warnings: consider either existing file OR env var presence
          command: ['sh', '-c', '([ -s "$HOME/.codex/auth.json" ] || [ -n "$CODEX_OAUTH_JSON" ]) || echo MISSING'],
          user: 'root',
          environment: { HOME: '/root' }
        })
        if ((check.stdout || '').includes('MISSING')) {
          await TaskMessageModel.create({
            id: uuidv4(),
            userId: task.userId,
            taskId: task._id,
            role: 'assistant',
            content: '⚠️ Codex OAuth not configured.\n\nPlace your OAuth JSON at `~/.codex/auth.json` inside the execution environment, or set the `CODEX_OAUTH_JSON` environment variable so it can be written automatically.'
          })
        }
      } catch (e) {
        // Non-fatal: ignore check errors
      }
    }

    // Fonction pour traiter les messages en temps réel
    const processStreamingOutput = async (data: string) => {
      const lines = data.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.trim() && !line.includes('===')) {
          this.logger.debug({ provider: AIProviderFactory.isGeminiProvider(aiProvider) ? 'Gemini' : (AIProviderFactory.isCodexProvider(aiProvider) ? 'Codex' : 'Claude'), output: line.trim() }, '🤖 AI output')

          // Ajouter la ligne au buffer
          streamBuffer += line + '\n'

          // Gestion du streaming Codex (parsing incrémental des blocs)
          if (isCodex) {
            const m = line.match(codexTsLine)
            if (m) {
              const rest = m[1]
              if (/^OpenAI Codex/i.test(rest)) {
                await codexStart('system', rest)
                continue
              }
              if (/^codex\s*$/i.test(rest)) {
                await codexStart('assistant')
                continue
              }
              if (/^apply_patch/i.test(rest)) {
                await codexStart('tool')
                continue
              }
              if (/^turn diff:/i.test(rest)) {
                await codexStart('diff')
                continue
              }
              if (/^User instructions:/i.test(rest)) {
                await codexStart('note', rest)
                continue
              }
              if (/^tokens used:/i.test(rest)) {
                await codexStart('note', rest)
                continue
              }
              // Other timestamped lines => notes
              await codexStart('note', rest)
              continue
            }

            // Non-timestamped line: append to current chunk or start assistant
            if (codexCurrentKind) {
              codexBuffer.push(line)
            } else if (line.trim()) {
              await codexStart('assistant')
              codexBuffer.push(line)
            }
            continue
          }

          // Pour Gemini, ne pas parser JSON
          if (AIProviderFactory.isGeminiProvider(aiProvider)) {
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
      planMode: false,
      mcpConfigPath,
      configOverrides: configOverrides || this.getProviderConfigOverrides(aiProvider, undefined, task),
      selectedMcpServers
    })

    // Streaming pour Claude/Codex; exécution standard pour Gemini
    let result: ExecuteResult
    if (AIProviderFactory.isClaudeProvider(aiProvider) || AIProviderFactory.isCodexProvider(aiProvider)) {
      result = await this.executeWithStreamingBash(containerId, script, processStreamingOutput)
    } else {
      result = await this.containerManager.executeInContainer({
        containerId,
        command: ['/bin/bash', '-c', script],
        user: 'root',
        environment: { HOME: '/root' }
      })
    }

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed with exit code ${result.exitCode}: ${result.stderr || 'No stderr output'}`)
    }

    const parsedOutput = adapter.parseOutput(result.stdout)

    // Si c'est Gemini ou Codex, gérer différemment
    if (AIProviderFactory.isGeminiProvider(aiProvider) || isCodex) {
      if (isCodex) {
        // Flush any remaining Codex chunk at end
        await codexFlush()

        if (codexChunksSaved > 0) {
          // Déjà sauvegardé en temps réel
          return codexLastAssistantText || 'Tâche terminée'
        }
        // Fallback: parser la sortie complète si aucun chunk en temps réel
        const finalText = await this.parseAndSaveCodexMessages(parsedOutput.finalResult || '', task, aiProviderLabel, model || '', actionLabel)
        return finalText || 'Tâche terminée'
      } else {
        // Créer un message avec la sortie brute de Gemini
        if ((parsedOutput.finalResult || '').trim()) {
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

  /**
   * Parse Codex streaming-like output and persist as multiple TaskMessage entries.
   * Produces assistant notes, tool blocks (apply_patch), diffs, and summaries similar to Claude output.
   */
  private async parseAndSaveCodexMessages(raw: string, task: any, aiProviderLabel: string, model: string, actionLabel: string): Promise<string> {
    const chunks = this.parseCodexStream(raw)

    if (chunks.length === 0) {
      // Fallback: save single message
      if (raw.trim()) {
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **${aiProviderLabel} (${model}) - ${actionLabel}:**\n\n${raw.trim()}`
        })
      }
      return raw.trim()
    }

    // Save each chunk as a separate message
    let lastAssistantText = ''
    for (const c of chunks) {
      let content: string
      switch (c.kind) {
        case 'system':
          content = `🟢 **${aiProviderLabel} (${model}) démarré**\n\n\`\`\`\n${c.content}\n\`\`\``
          break
        case 'tool':
          content = `🔧 **apply_patch**\n\n\`\`\`diff\n${c.content}\n\`\`\``
          break
        case 'diff':
          content = `🔧 **turn diff**\n\n\`\`\`diff\n${c.content}\n\`\`\``
          break
        case 'note':
          // Skip tokens usage notes; user doesn't want them stored/shown
          if (/^tokens used:/i.test(c.content.trim())) {
            continue
          }
          content = `📝 ${c.content}`
          break
        case 'assistant':
        default:
          content = c.content
          lastAssistantText = c.content
          break
      }

      // Skip echoing user instructions (already saved as user message)
      if (c.kind === 'note' && /User instructions:/i.test(c.content)) {
        continue
      }

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content
      })
    }

    return lastAssistantText || chunks.map(c => c.content).join('\n\n')
  }

  /**
   * Convert Codex CLI logs into structured chunks.
   */
  private parseCodexStream(raw: string): Array<{ kind: 'assistant' | 'tool' | 'diff' | 'system' | 'note'; content: string }> {
    const lines = raw.split(/\r?\n/)
    const chunks: Array<{ kind: 'assistant' | 'tool' | 'diff' | 'system' | 'note'; content: string }> = []

    const tsLine = /^\[[0-9]{4}-[0-9]{2}-[0-9]{2}T[^\]]+\]\s*(.*)$/

    let currentKind: 'assistant' | 'tool' | 'diff' | 'system' | 'note' | null = null
    let buffer: string[] = []

    const flush = () => {
      if (currentKind && buffer.length) {
        const content = buffer.join('\n').trim()
        if (content) chunks.push({ kind: currentKind, content })
      }
      currentKind = null
      buffer = []
    }

    const start = (kind: typeof currentKind) => {
      flush()
      currentKind = kind
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Ignore stream boundary markers
      if (/^===\s*STREAM (START|END)/.test(line)) {
        continue
      }

      const m = line.match(tsLine)
      if (m) {
        const rest = m[1]

        if (/^OpenAI Codex/i.test(rest)) {
          start('system')
          buffer.push(rest)
          continue
        }
        if (/^codex\s*$/i.test(rest)) {
          start('assistant')
          continue
        }
        if (/^apply_patch/i.test(rest)) {
          start('tool')
          // keep the header details for context, but main payload will follow in subsequent lines
          continue
        }
        if (/^turn diff:/i.test(rest)) {
          start('diff')
          continue
        }
        if (/^User instructions:/i.test(rest)) {
          start('note')
          buffer.push(rest)
          continue
        }
        if (/^tokens used:/i.test(rest)) {
          start('note')
          buffer.push(rest)
          continue
        }

        // Other timestamped status lines: treat as notes
        start('note')
        buffer.push(rest)
        continue
      }

      // Non-timestamp lines belong to current chunk; also capture system header details between '--------' separators
      if (currentKind) {
        // Stop capturing system header at next separator end followed by blank line then bracketed line? Keep simple: keep until next ts line.
        buffer.push(line)
      } else {
        // If no current kind and line has content, heuristically start assistant block
        if (line.trim()) {
          start('assistant')
          buffer.push(line)
        }
      }
    }

    flush()

    // Post-process: condense large diffs by trimming trailing empty lines
    return chunks.map(c => ({ ...c, content: c.content.replace(/\n+$/,'') }))
  }

  private getAiCommand(aiProvider: string, model?: string): string {
    const modelParam = model ? ` --model ${model}` : ''

    switch (aiProvider) {
      case 'anthropic-api':
        return `claude --verbose --output-format stream-json${modelParam} --allowedTools "Edit" -p`
      case 'claude-oauth':
        return `claude --verbose --output-format stream-json${modelParam} --allowedTools "Edit" -p`
      case 'gemini-cli':
        return `gemini${modelParam} -p`
      case 'admin-gemini':
        return `gemini${modelParam} -p`
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`)
    }
  }

  private async setupSubAgents(containerId: string, environment: any, task: any): Promise<void> {
    this.logger.info({ subAgentIds: environment.subAgents }, '🤖 Setting up SubAgents files for Claude Code')

    try {
      // Récupérer les SubAgents liés à cet environnement depuis la base de données
      const subAgents = await SubAgentModel.find({
        _id: { $in: environment.subAgents },
        $or: [
          { isPublic: true },
          { userId: task.userId }
        ]
      }).lean()

      if (subAgents.length === 0) {
        this.logger.warn('No accessible SubAgents found for this task')
        return
      }

      this.logger.info({ foundSubAgents: subAgents.length }, '✅ Found accessible SubAgents')

      // Créer le répertoire ~/.claude/agents/ s'il n'existe pas
      const setupDirScript = `
        mkdir -p ~/.claude/agents
        chmod 755 ~/.claude/agents
        echo "SubAgents directory created successfully"
      `

      const setupResult = await this.executeWithStreamingBash(containerId, setupDirScript)
      if (setupResult.exitCode !== 0) {
        throw new Error(`Failed to create SubAgents directory: ${setupResult.stderr}`)
      }

      // Créer un fichier pour chaque SubAgent
      const createdAgents: string[] = []
      for (const subAgent of subAgents) {
        const agentFileName = this.sanitizeAgentName(subAgent.name)
        const agentContent = this.generateAgentFileContent(subAgent)

        // Créer le fichier de l'agent
        const createFileScript = `
          cat > ~/.claude/agents/${agentFileName}.md << 'EOF'
${agentContent}
EOF
          chmod 644 ~/.claude/agents/${agentFileName}.md
          echo "Agent file created: ${agentFileName}.md"
        `

        const createResult = await this.executeWithStreamingBash(containerId, createFileScript)
        if (createResult.exitCode === 0) {
          createdAgents.push(agentFileName)
          this.logger.info({ agentName: agentFileName }, '✅ SubAgent file created successfully')
        } else {
          this.logger.error({ agentName: agentFileName, error: createResult.stderr }, '❌ Failed to create SubAgent file')
        }
      }

      if (createdAgents.length > 0) {
        // Créer un message de confirmation
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **SubAgents configurés pour Claude Code:**\n\n${createdAgents.map(name => `- \`${name}\``).join('\n')}\n\nCes SubAgents sont maintenant disponibles pour Claude Code dans cette tâche.`
        })

        this.logger.info({ createdCount: createdAgents.length }, '✅ SubAgents setup completed successfully')
      }
    } catch (error: any) {
      this.logger.error({ error: error.message }, '❌ Error setting up SubAgents')
      throw error
    }
  }

  private sanitizeAgentName(name: string): string {
    // Convertir en lowercase et remplacer espaces/caractères spéciaux par des hyphens
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  private generateAgentFileContent(subAgent: any): string {
    const sanitizedName = this.sanitizeAgentName(subAgent.name)
    const description = subAgent.description || `SubAgent for ${subAgent.name}`
    const prompt = subAgent.prompt || `You are ${subAgent.name}, a specialized assistant.`

    return `---
name: ${sanitizedName}
description: ${description}
---

${prompt}`
  }
}
