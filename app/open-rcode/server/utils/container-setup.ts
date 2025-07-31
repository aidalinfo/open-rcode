import { DockerManager } from './docker'
import { BaseContainerManager } from './container/base-container-manager'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { UserModel } from '../models/User'
import { decrypt } from './crypto'
import { RepositoryCloner } from './repository-cloner'
import { DockerAdapter } from './container/docker-adapter'
import { logger } from './logger'

export interface TaskContainerOptions {
  taskId: string
  runtimeVersion?: string
  workspaceDir?: string
  additionalEnvVars?: Record<string, string>
}

export interface ContainerSetupResult {
  containerId: string
  containerName: string
  workspaceDir: string
  claudeCommand?: string
}

function generateUniqueWorkspace(taskId: string, repository: string): string {
  const timestamp = Date.now()
  const taskPrefix = taskId.substring(0, 8)
  return `/tmp/workspace-${timestamp}-${taskPrefix}/${repository}`
}

export class ContainerSetup {
  private containerManager: BaseContainerManager
  private docker: DockerManager // Maintenu pour compatibility avec RepositoryCloner

  constructor(containerManager: BaseContainerManager, docker?: DockerManager) {
    this.containerManager = containerManager
    this.docker = docker || new DockerManager() // Fallback pour RepositoryCloner
  }

  async setupContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    const task = await TaskModel.findById(options.taskId)
    if (!task) {
      throw new Error(`Task ${options.taskId} not found`)
    }

    const environment = await EnvironmentModel.findById(task.environmentId)
    if (!environment) {
      throw new Error(`Environment ${task.environmentId} not found`)
    }

    const user = await UserModel.findOne({ githubId: task.userId })
    if (!user) {
      throw new Error(`User ${task.userId} not found`)
    }

    // Utiliser le provider AI spécifié dans l'environnement
    let aiProvider = environment.aiProvider
    let requiredToken: string | null = null

    // Vérifier que le provider est spécifié
    if (!aiProvider) {
      throw new Error(`No AI provider specified in environment ${environment._id}. Please configure an AI provider.`)
    }

    // Vérifier que le token requis est disponible pour le provider choisi
    if (!this.isTokenAvailable(user, aiProvider)) {
      const providerName = this.getProviderDisplayName(aiProvider)
      const missingTokenMessage = this.getMissingTokenMessage(aiProvider)
      throw new Error(`${providerName} is selected but ${missingTokenMessage} for user ${task.userId}. Please configure the required credentials in your settings.`)
    }

    // Utiliser le provider spécifié avec ses credentials
    logger.info({ aiProvider, userId: task.userId }, 'Using AI provider')
    
    switch (aiProvider) {
      case 'anthropic-api':
        requiredToken = decrypt(user.anthropicKey!)
        logger.info({ userId: task.userId }, '✓ Using Anthropic API key')
        break
      case 'claude-oauth':
        requiredToken = decrypt(user.claudeOAuthToken!)
        logger.info({ userId: task.userId }, '✓ Using Claude OAuth token')
        break
      case 'gemini-cli':
        requiredToken = decrypt(user.geminiApiKey!)
        logger.info({ userId: task.userId }, '✓ Using Gemini API key')
        break
      case 'admin-gemini':
        // Admin Gemini utilise la clé admin du système
        requiredToken = process.env.ADMIN_GOOGLE_API_KEY || ''
        logger.info({ userId: task.userId }, '✓ Using Admin Gemini API key')
        break
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`)
    }

    const containerName = `ccweb-task-${task._id}-${Date.now()}`
    const workspaceDir = options.workspaceDir || generateUniqueWorkspace(options.taskId, environment.repository)

    const envVars = this.prepareEnvironmentVariables(environment, requiredToken, aiProvider, options.additionalEnvVars)

    // Only ensure Docker image if we're using Docker mode
    if (this.containerManager instanceof DockerAdapter) {
      await this.ensureDockerImage('ccweb-task-runner:latest')
    }

    const containerId = await this.containerManager.createContainer({
      image: 'ghcr.io/aidalinfo/open-rcoder-worker:latest',
      name: containerName,
      workdir: workspaceDir,
      environment: envVars,
      autoRemove: false
    })

    await this.waitForContainerReady(containerId)

    // Cloner le repository directement dans le conteneur après le setup
    await this.cloneRepositoryInContainer(task, environment, containerId, workspaceDir)

    return {
      containerId,
      containerName,
      workspaceDir,
      claudeCommand: 'claude'
    }
  }

  private prepareEnvironmentVariables(
    environment: any,
    aiToken: string,
    aiProvider: string,
    additionalEnvVars?: Record<string, string>
  ): Record<string, string> {
    const envVars: Record<string, string> = {
      CODEX_ENV_PYTHON_VERSION: '3.12',
      CODEX_ENV_NODE_VERSION: '20',
      CODEX_ENV_RUST_VERSION: '1.87.0',
      CODEX_ENV_GO_VERSION: '1.23.8',
      CODEX_ENV_SWIFT_VERSION: '6.1',
      ...Object.fromEntries(
        environment.environmentVariables.map((envVar: any) => [envVar.key, envVar.value])
      ),
      ...additionalEnvVars
    }

    // Configurer les variables d'environnement selon le provider IA sélectionné
    switch (aiProvider) {
      case 'anthropic-api':
        envVars.ANTHROPIC_API_KEY = aiToken
        break
      case 'claude-oauth':
        envVars.CLAUDE_CODE_OAUTH_TOKEN = aiToken
        break
      case 'gemini-cli':
        envVars.GEMINI_API_KEY = aiToken
        break
    }

    switch (environment.runtime) {
      case 'node':
        envVars.CODEX_ENV_NODE_VERSION = this.getRuntimeVersion(environment.runtime)
        break
      case 'python':
        envVars.CODEX_ENV_PYTHON_VERSION = this.getRuntimeVersion(environment.runtime)
        break
      case 'php':
        envVars.CODEX_ENV_PHP_VERSION = this.getRuntimeVersion(environment.runtime)
        break
    }

    return envVars
  }


  async cloneRepositoryInContainer(task: any, environment: any, containerId: string, workspaceDir?: string): Promise<void> {
    const cloner = new RepositoryCloner(this.containerManager)
    await cloner.cloneInContainer(task, environment, containerId, workspaceDir)
  }

  private async waitForContainerReady(containerId: string, maxWaitTime: number = 180000): Promise<void> {
    logger.info({ containerId, maxWaitTime }, 'Waiting for container to be ready')
    
    const startTime = Date.now()
    const checkInterval = 5000
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const logs = await this.containerManager.getContainerLogs(containerId, 50)
        
        if (logs.includes('Environment ready') || logs.includes('Dropping you into a bash shell')) {
          logger.info({ containerId }, 'Container is ready!')
          await new Promise(resolve => setTimeout(resolve, 5000))
          return
        }
        
        logger.debug({ containerId, elapsedSeconds: Math.floor((Date.now() - startTime) / 1000) }, 'Container still setting up')
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        
      } catch (error: any) {
        logger.warn({ error, containerId }, 'Error checking container readiness')
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
    }
    
    logger.warn({ containerId, timeoutSeconds: maxWaitTime / 1000 }, 'Container setup timeout, proceeding anyway')
  }

  private async ensureDockerImage(imageName: string): Promise<void> {
    const images = await this.docker.getDockerInstance().listImages({
      filters: { reference: [imageName] }
    })
    
    if (images.length === 0) {
      if (imageName === 'ghcr.io/aidalinfo/open-rcoder-worker:latest') {
        await this.buildCustomDockerImage()
      } else {
        const stream = await this.docker.getDockerInstance().pull(imageName)
        await new Promise((resolve, reject) => {
          this.docker.getDockerInstance().modem.followProgress(stream, (err: any, res: any) => {
            if (err) reject(err)
            else resolve(res)
          })
        })
      }
    }
  }

  private async buildCustomDockerImage(): Promise<void> {
    const path = await import('path')
    const tar = await import('tar-fs')
    
    const dockerContextPath = path.resolve(process.cwd(), 'server/utils/docker')
    const dockerContext = tar.pack(dockerContextPath)
    
    const stream = await this.docker.getDockerInstance().buildImage(dockerContext, {
      t: 'ccweb-task-runner:latest',
      dockerfile: 'Dockerfile'
    })
    
    await new Promise((resolve, reject) => {
      this.docker.getDockerInstance().modem.followProgress(stream, (err: any, res: any) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  private getRuntimeVersion(runtime: string): string {
    const versions: Record<string, string> = {
      node: '20',
      python: '3.12',
      php: '8.3'
    }
    return versions[runtime] || versions.node
  }

  private isTokenAvailable(user: any, provider: string): boolean {
    switch (provider) {
      case 'anthropic-api':
        return !!user.anthropicKey
      case 'claude-oauth':
        return !!user.claudeOAuthToken
      case 'gemini-cli':
        return !!user.geminiApiKey
      case 'admin-gemini':
        return !!process.env.ADMIN_GOOGLE_API_KEY
      default:
        return false
    }
  }

  private getProviderDisplayName(provider: string): string {
    switch (provider) {
      case 'anthropic-api':
        return 'Anthropic API'
      case 'claude-oauth':
        return 'Claude OAuth'
      case 'gemini-cli':
        return 'Gemini'
      case 'admin-gemini':
        return 'Admin Gemini'
      default:
        return provider
    }
  }

  private getMissingTokenMessage(provider: string): string {
    switch (provider) {
      case 'anthropic-api':
        return 'no Anthropic API key is configured'
      case 'claude-oauth':
        return 'no Claude OAuth token is configured'
      case 'gemini-cli':
        return 'no Gemini API key is configured'
      case 'admin-gemini':
        return 'no admin Gemini API key is configured in the system'
      default:
        return 'the required credentials are not configured'
    }
  }
}