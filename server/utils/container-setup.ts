import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { UserModel } from '../models/User'
import { decrypt } from './crypto'
import { RepositoryCloner } from './repository-cloner'

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

export class ContainerSetup {
  private docker: DockerManager

  constructor(docker: DockerManager) {
    this.docker = docker
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
    if (!user || !user.anthropicKey) {
      throw new Error(`User ${task.userId} not found or Anthropic API key not configured`)
    }

    const anthropicKey = decrypt(user.anthropicKey)
    const containerName = `ccweb-task-${task._id}-${Date.now()}`
    const workspaceDir = options.workspaceDir || `/workspace/${environment.repository}`

    const envVars = this.prepareEnvironmentVariables(environment, anthropicKey, options.additionalEnvVars)
    const volumes = await this.prepareVolumes(task, environment)

    await this.ensureDockerImage('ccweb-task-runner:latest')

    const containerId = await this.docker.createContainer({
      image: 'ccweb-task-runner:latest',
      name: containerName,
      workdir: workspaceDir,
      environment: envVars,
      volumes,
      autoRemove: false,
      networkMode: 'bridge'
    })

    await this.waitForContainerReady(containerId)

    return {
      containerId,
      containerName,
      workspaceDir,
      claudeCommand: 'claude'
    }
  }

  private prepareEnvironmentVariables(
    environment: any,
    anthropicKey: string,
    additionalEnvVars?: Record<string, string>
  ): Record<string, string> {
    const envVars: Record<string, string> = {
      CODEX_ENV_PYTHON_VERSION: '3.12',
      CODEX_ENV_NODE_VERSION: '20',
      CODEX_ENV_RUST_VERSION: '1.87.0',
      CODEX_ENV_GO_VERSION: '1.23.8',
      CODEX_ENV_SWIFT_VERSION: '6.1',
      CLAUDE_CODE_OAUTH_TOKEN: anthropicKey,
      ...Object.fromEntries(
        environment.environmentVariables.map((envVar: any) => [envVar.key, envVar.value])
      ),
      ...additionalEnvVars
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

  private async prepareVolumes(task: any, environment: any): Promise<string[]> {
    const volumes: string[] = []
    const fs = await import('fs')

    const hostWorkspaceDir = `/tmp/ccweb-workspaces/${task._id}`
    const containerWorkspaceDir = `/workspace/${environment.repository}`
    
    if (!fs.existsSync(hostWorkspaceDir)) {
      fs.mkdirSync(hostWorkspaceDir, { recursive: true })
    }

    await this.cloneRepository(task, environment, hostWorkspaceDir)
    volumes.push(`${hostWorkspaceDir}:${containerWorkspaceDir}`)

    const claudeConfigDir = '/tmp/ccweb-claude-config'
    if (!fs.existsSync(claudeConfigDir)) {
      fs.mkdirSync(claudeConfigDir, { recursive: true })
    }
    volumes.push(`${claudeConfigDir}:/home/user/.config/claude`)

    return volumes
  }

  private async cloneRepository(task: any, environment: any, hostDir: string): Promise<void> {
    const cloner = new RepositoryCloner()
    await cloner.cloneToHost(task, environment, hostDir)
  }

  private async waitForContainerReady(containerId: string, maxWaitTime: number = 180000): Promise<void> {
    console.log(`Waiting for container ${containerId} to be ready...`)
    
    const startTime = Date.now()
    const checkInterval = 5000
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const logs = await this.docker.getContainerLogs(containerId, 50)
        
        if (logs.includes('Environment ready') || logs.includes('Dropping you into a bash shell')) {
          console.log(`Container ${containerId} is ready!`)
          await new Promise(resolve => setTimeout(resolve, 5000))
          return
        }
        
        console.log(`Container still setting up... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        
      } catch (error) {
        console.warn(`Error checking container readiness: ${error.message}`)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
    }
    
    console.warn(`Container ${containerId} setup timeout after ${maxWaitTime / 1000}s, proceeding anyway...`)
  }

  private async ensureDockerImage(imageName: string): Promise<void> {
    const images = await this.docker.getDockerInstance().listImages({
      filters: { reference: [imageName] }
    })
    
    if (images.length === 0) {
      if (imageName === 'ccweb-task-runner:latest') {
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
}