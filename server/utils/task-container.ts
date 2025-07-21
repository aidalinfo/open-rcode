import { DockerManager } from './docker'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { UserModel } from '../models/User'
import { connectToDatabase } from './database'
import { decrypt } from './crypto'
import { generateInstallationToken, getInstallationRepositories } from './github-app'
import crypto from 'crypto'

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

export class TaskContainerManager {
  private docker: DockerManager

  constructor(dockerOptions?: any) {
    this.docker = new DockerManager(dockerOptions)
  }

  /**
   * Crée un environnement Docker pour une tâche avec Claude Code
   */
  async createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    await connectToDatabase()

    // Récupérer la tâche
    const task = await TaskModel.findById(options.taskId).populate('environmentId')
    if (!task) {
      throw new Error(`Task ${options.taskId} not found`)
    }

    // Récupérer l'environnement
    const environment = await EnvironmentModel.findById(task.environmentId)
    if (!environment) {
      throw new Error(`Environment ${task.environmentId} not found`)
    }

    // Récupérer l'utilisateur pour la clé API
    const user = await UserModel.findOne({ githubId: task.userId })
    if (!user || !user.anthropicKey) {
      throw new Error(`User ${task.userId} not found or Anthropic API key not configured`)
    }

    // Déchiffrer la clé API
    const anthropicKey = decrypt(user.anthropicKey)

    // Générer le nom du conteneur
    const containerName = `ccweb-task-${task._id}-${Date.now()}`
    const workspaceDir = options.workspaceDir || `/workspace/${environment.repository}`

    // Préparer les variables d'environnement
    const envVars = this.prepareEnvironmentVariables(environment, anthropicKey, options.additionalEnvVars)

    // Préparer les volumes
    const volumes = await this.prepareVolumes(task, environment)

    // S'assurer que l'image Docker personnalisée est disponible
    await this.ensureDockerImage('ccweb-task-runner:latest')

    // Créer le conteneur avec notre image personnalisée
    const containerId = await this.docker.createContainer({
      image: 'ccweb-task-runner:latest',
      name: containerName,
      workdir: workspaceDir,
      environment: envVars,
      volumes,
      autoRemove: false, // On veut pouvoir récupérer les logs
      // L'entrypoint est déjà configuré dans le Dockerfile pour installer Claude Code et rester actif
      networkMode: 'bridge'
    })

    // Attendre que le conteneur soit prêt (Claude Code sera installé automatiquement par l'entrypoint)
    await this.waitForContainerReady(containerId)

    // Mettre à jour la tâche avec l'ID du conteneur
    task.dockerId = containerId
    task.messages.push({
      role: 'assistant',
      content: `🐳 Environnement Docker créé avec succès.\n**Conteneur:** \`${containerName}\`\n**ID:** \`${containerId.substring(0, 12)}\``,
      timestamp: new Date()
    })
    await task.save()

    return {
      containerId,
      containerName,
      workspaceDir,
      claudeCommand: 'claude'
    }
  }

  /**
   * Prépare les variables d'environnement pour le conteneur
   */
  private prepareEnvironmentVariables(
    environment: any,
    anthropicKey: string,
    additionalEnvVars?: Record<string, string>
  ): Record<string, string> {
    const envVars: Record<string, string> = {
      // Variables Codex
      CODEX_ENV_PYTHON_VERSION: '3.12',
      CODEX_ENV_NODE_VERSION: '20',
      CODEX_ENV_RUST_VERSION: '1.87.0',
      CODEX_ENV_GO_VERSION: '1.23.8',
      CODEX_ENV_SWIFT_VERSION: '6.1',
      
      // Claude Code
      ANTHROPIC_API_KEY: anthropicKey,
      
      // Variables d'environnement personnalisées de l'environment
      ...Object.fromEntries(
        environment.environmentVariables.map((envVar: any) => [envVar.key, envVar.value])
      ),
      
      // Variables additionnelles
      ...additionalEnvVars
    }

    // Ajuster la version selon le runtime de l'environnement
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

  /**
   * Prépare les volumes pour le conteneur et clone le repository
   */
  private async prepareVolumes(task: any, environment: any): Promise<string[]> {
    const volumes: string[] = []
    const fs = await import('fs')
    const path = await import('path')

    // Créer le répertoire workspace sur l'hôte
    const hostWorkspaceDir = `/tmp/ccweb-workspaces/${task._id}`
    const containerWorkspaceDir = `/workspace/${environment.repository}`
    
    // S'assurer que le répertoire existe
    if (!fs.existsSync(hostWorkspaceDir)) {
      fs.mkdirSync(hostWorkspaceDir, { recursive: true })
    }

    // Cloner le repository GitHub avec les credentials de l'utilisateur
    await this.cloneRepositoryToHost(task, environment, hostWorkspaceDir)
    
    volumes.push(`${hostWorkspaceDir}:${containerWorkspaceDir}`)

    // Volume pour Claude Code config
    const claudeConfigDir = '/tmp/ccweb-claude-config'
    if (!fs.existsSync(claudeConfigDir)) {
      fs.mkdirSync(claudeConfigDir, { recursive: true })
    }
    volumes.push(`${claudeConfigDir}:/home/user/.config/claude`)

    return volumes
  }

  /**
   * Clone le repository GitHub sur l'hôte en utilisant les tokens d'installation GitHub App
   */
  private async cloneRepositoryToHost(task: any, environment: any, hostDir: string): Promise<void> {
    try {
      // Récupérer l'utilisateur
      const user = await UserModel.findOne({ githubId: task.userId })
      if (!user) {
        throw new Error(`User ${task.userId} not found`)
      }

      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      let repositoryUrl: string
      let gitCommand: string
      let installationToken: string | null = null

      // Essayer de trouver une installation GitHub App qui contient ce repository
      if (user.githubAppInstallationIds && user.githubAppInstallationIds.length > 0) {
        try {
          installationToken = await this.findInstallationTokenForRepository(
            user.githubAppInstallationIds,
            environment.repositoryFullName
          )
        } catch (error) {
          console.warn(`Could not find GitHub App installation for repository ${environment.repositoryFullName}:`, error)
        }
      }

      if (installationToken) {
        // Utiliser le token d'installation GitHub App
        repositoryUrl = `https://x-access-token:${installationToken}@github.com/${environment.repositoryFullName}.git`
        gitCommand = `git clone ${repositoryUrl} ${hostDir}/repo`
        console.log(`Cloning repository ${environment.repositoryFullName} with GitHub App token`)
      } else {
        // Fallback: clone public sans authentification
        repositoryUrl = `https://github.com/${environment.repositoryFullName}.git`
        gitCommand = `git clone ${repositoryUrl} ${hostDir}/repo`
        console.log(`Cloning public repository ${environment.repositoryFullName} (no GitHub App access)`)
      }

      // Cloner le repository
      await execAsync(gitCommand, {
        cwd: '/tmp',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0' // Éviter les prompts interactifs
        }
      })

      console.log(`Repository cloned successfully to ${hostDir}/repo`)

      // Configurer git dans le repository cloné
      const gitConfigCommands = [
        `git config user.name "${user.name || user.username}"`,
        `git config user.email "${user.email || `${user.username}@users.noreply.github.com`}"`
      ]

      for (const cmd of gitConfigCommands) {
        await execAsync(cmd, { cwd: `${hostDir}/repo` })
      }

    } catch (error) {
      console.error(`Error cloning repository ${environment.repositoryFullName}:`, error)
      
      // Si le clonage échoue, créer un répertoire vide avec un fichier README
      const fs = await import('fs')
      const repoDir = `${hostDir}/repo`
      
      if (!fs.existsSync(repoDir)) {
        fs.mkdirSync(repoDir, { recursive: true })
      }
      
      let errorMessage = 'Erreur inconnue lors du clonage'
      
      if (error.message.includes('Repository not found') || error.message.includes('not found')) {
        errorMessage = `Le repository ${environment.repositoryFullName} n'existe pas ou n'est pas accessible.`
      } else if (error.message.includes('Authentication failed') || error.message.includes('Permission denied')) {
        errorMessage = 'Le repository est privé et nécessite l\'installation de la GitHub App avec les bonnes permissions.'
      } else {
        errorMessage = `Erreur lors du clonage: ${error.message}`
      }
      
      const readmeContent = `# ${environment.repository}

Repository: ${environment.repositoryFullName}
Environment: ${environment.name}

⚠️ Le clonage automatique du repository a échoué.
${errorMessage}

**Actions possibles :**
1. Vérifiez que le repository existe sur GitHub
2. Assurez-vous que la GitHub App est installée sur ce repository
3. Vérifiez les permissions de la GitHub App

Vous pouvez cloner manuellement le repository ou créer vos fichiers ici.

\`\`\`bash
git clone https://github.com/${environment.repositoryFullName}.git .
\`\`\`
`
      
      fs.writeFileSync(`${repoDir}/README.md`, readmeContent)
      console.log(`Created fallback README in ${repoDir} due to: ${errorMessage}`)
    }
  }

  /**
   * Trouve le token d'installation GitHub App pour un repository donné
   */
  private async findInstallationTokenForRepository(
    installationIds: string[], 
    repositoryFullName: string
  ): Promise<string | null> {
    // Essayer chaque installation pour voir laquelle contient le repository
    for (const installationId of installationIds) {
      try {
        console.log(`Checking installation ${installationId} for repository ${repositoryFullName}`)
        
        // Récupérer les repositories de cette installation
        const installationRepos = await getInstallationRepositories(installationId)
        
        // Vérifier si le repository est dans cette installation
        const hasRepository = installationRepos.repositories.some(
          (repo: any) => repo.full_name === repositoryFullName
        )
        
        if (hasRepository) {
          console.log(`Found repository ${repositoryFullName} in installation ${installationId}`)
          // Générer un token pour cette installation
          return await generateInstallationToken(installationId)
        }
      } catch (error) {
        console.warn(`Error checking installation ${installationId}:`, error)
        continue
      }
    }
    
    console.log(`Repository ${repositoryFullName} not found in any GitHub App installation`)
    return null
  }

  /**
   * Attend que le conteneur soit prêt (setup terminé)
   */
  private async waitForContainerReady(containerId: string, maxWaitTime: number = 180000): Promise<void> {
    console.log(`Waiting for container ${containerId} to be ready...`)
    
    const startTime = Date.now()
    const checkInterval = 5000 // Vérifier toutes les 5 secondes
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Vérifier si le setup est terminé en cherchant le message "Environment ready"
        const logs = await this.docker.getContainerLogs(containerId, 50)
        
        if (logs.includes('Environment ready') || logs.includes('Dropping you into a bash shell')) {
          console.log(`Container ${containerId} is ready!`)
          
          // Attendre encore 5 secondes pour être sûr que tout est stable
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

  /**
   * S'assure que l'image Docker est disponible localement
   */
  private async ensureDockerImage(imageName: string): Promise<void> {
    try {
      console.log(`Checking if image ${imageName} exists locally...`)
      
      // Vérifier si l'image existe localement
      const images = await this.docker.docker.listImages({
        filters: { reference: [imageName] }
      })
      
      if (images.length === 0) {
        if (imageName === 'ccweb-task-runner:latest') {
          console.log(`Image ${imageName} not found locally, building from Dockerfile...`)
          await this.buildCustomDockerImage()
        } else {
          console.log(`Image ${imageName} not found locally, pulling...`)
          
          // Télécharger l'image
          const stream = await this.docker.docker.pull(imageName)
          
          // Attendre que le téléchargement soit terminé
          await new Promise((resolve, reject) => {
            this.docker.docker.modem.followProgress(stream, (err: any, res: any) => {
              if (err) {
                reject(err)
              } else {
                resolve(res)
              }
            })
          })
          
          console.log(`Image ${imageName} pulled successfully`)
        }
      } else {
        console.log(`Image ${imageName} already exists locally`)
      }
    } catch (error) {
      console.error(`Error ensuring Docker image ${imageName}:`, error)
      throw new Error(`Failed to ensure Docker image: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Construit l'image Docker personnalisée
   */
  private async buildCustomDockerImage(): Promise<void> {
    try {
      const path = await import('path')
      const dockerContextPath = path.resolve(process.cwd(), 'server/utils/docker')
      
      console.log(`Building Docker image from ${dockerContextPath}...`)
      
      // Créer un tar stream pour le contexte Docker
      const tar = await import('tar-fs')
      const dockerContext = tar.pack(dockerContextPath)
      
      // Construire l'image
      const stream = await this.docker.docker.buildImage(dockerContext, {
        t: 'ccweb-task-runner:latest',
        dockerfile: 'Dockerfile'
      })
      
      // Attendre que la construction soit terminée
      await new Promise((resolve, reject) => {
        this.docker.docker.modem.followProgress(stream, (err: any, res: any) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        }, (event: any) => {
          // Log les étapes de construction
          if (event.stream) {
            console.log(event.stream.trim())
          }
        })
      })
      
      console.log('Docker image ccweb-task-runner:latest built successfully')
    } catch (error) {
      console.error('Error building Docker image:', error)
      throw new Error(`Failed to build Docker image: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Installe Claude Code dans le conteneur
   */
  private async installClaudeCode(containerId: string, anthropicKey: string): Promise<void> {
    try {
      // L'image codex-universal utilise NVM pour Node.js, il faut sourcer NVM d'abord
      console.log(`Installing Claude Code in container ${containerId}...`)
      
      // Script d'installation qui source NVM et installe Claude Code
      const installScript = `
        export NVM_DIR="/root/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
        
        echo "Node version: $(node --version)"
        echo "NPM version: $(npm --version)"
        
        npm install -g @anthropic-ai/claude-code
      `
      
      const installResult = await this.docker.executeInContainer({
        containerId,
        command: ['bash', '-c', installScript],
        user: 'root'
      })
      
      console.log(`NPM install output: ${installResult.stdout}`)
      if (installResult.stderr) {
        console.log(`NPM install stderr: ${installResult.stderr}`)
      }

      // Trouver où Claude Code a été installé avec NVM chargé
      const findClaudeScript = `
        export NVM_DIR="/root/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        
        which claude || find /root/.nvm -name claude -type f 2>/dev/null || echo "Claude not found"
      `
      
      const findClaudeResult = await this.docker.executeInContainer({
        containerId,
        command: ['bash', '-c', findClaudeScript],
        user: 'root'
      })
      
      console.log(`Claude binary location: ${findClaudeResult.stdout}`)

      // Vérifier le PATH avec NVM
      const pathScript = `
        export NVM_DIR="/root/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        
        echo "PATH: $PATH"
        echo "Node: $(which node)"
        echo "NPM: $(which npm)"
        echo "Claude: $(which claude || echo 'not in PATH')"
      `
      
      const pathResult = await this.docker.executeInContainer({
        containerId,
        command: ['bash', '-c', pathScript],
        user: 'root'
      })
      
      console.log(`Environment check: ${pathResult.stdout}`)

      // Configurer Claude Code avec la clé API pour l'utilisateur root
      const configScript = `
        mkdir -p /root/.config/claude
        echo '{"api_key": "${anthropicKey}"}' > /root/.config/claude/config.json
        echo 'Claude Code configured for root user'
      `

      await this.docker.executeInContainer({
        containerId,
        command: ['bash', '-c', configScript],
        user: 'root'
      })

      // Tester Claude avec NVM
      try {
        const testScript = `
          export NVM_DIR="/root/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          
          claude --version || echo "Claude command failed"
        `
        
        const testResult = await this.docker.executeInContainer({
          containerId,
          command: ['bash', '-c', testScript],
          user: 'root'
        })
        
        console.log(`Claude version test: ${testResult.stdout}`)
        if (testResult.stderr) {
          console.log(`Claude version stderr: ${testResult.stderr}`)
        }
      } catch (versionError) {
        console.warn(`Could not get Claude version, but installation might still work: ${versionError.message}`)
      }

      console.log(`Claude Code installation completed for container ${containerId}`)
    } catch (error) {
      console.error(`Error installing Claude Code in container ${containerId}:`, error)
      throw new Error(`Failed to install Claude Code: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Exécute une commande Claude dans le conteneur
   */
  async executeClaudeCommand(containerId: string, prompt: string, workdir?: string): Promise<string> {
    try {
      // Script pour exécuter Claude (NVM est déjà sourcé par l'entrypoint)
      const claudeScript = `
        source /etc/profile
        source /root/.nvm/nvm.sh
        
        cd "${workdir || '/workspace'}"
        claude --prompt "${prompt.replace(/"/g, '\\"')}"
      `

      console.log(`Executing Claude command in container ${containerId}`)

      // Exécuter Claude
      const result = await this.docker.executeInContainer({
        containerId,
        command: ['bash', '-l', '-c', claudeScript],
        user: 'root',
        environment: {
          'HOME': '/root'
        }
      })

      if (result.exitCode !== 0) {
        throw new Error(`Claude command failed with exit code ${result.exitCode}: ${result.stderr}`)
      }

      return result.stdout
    } catch (error) {
      console.error(`Error executing Claude command in container ${containerId}:`, error)
      throw error
    }
  }

  /**
   * Obtient la version du runtime à utiliser
   */
  private getRuntimeVersion(runtime: string): string {
    const versions: Record<string, string> = {
      node: '20',
      python: '3.12',
      php: '8.3'
    }
    return versions[runtime] || versions.node
  }

  /**
   * Nettoie le conteneur et les fichiers temporaires
   */
  async cleanupTaskContainer(taskId: string): Promise<void> {
    try {
      const task = await TaskModel.findById(taskId)
      if (!task || !task.dockerId) {
        return
      }

      // Arrêter et supprimer le conteneur
      try {
        await this.docker.stopContainer(task.dockerId)
        await this.docker.removeContainer(task.dockerId, true)
      } catch (error) {
        console.warn(`Container ${task.dockerId} may have already been removed`)
      }

      // Nettoyer les fichiers temporaires
      const hostWorkspaceDir = `/tmp/ccweb-workspaces/${taskId}`
      try {
        await this.docker.executeInContainer({
          containerId: 'host', // Commande sur l'hôte
          command: ['rm', '-rf', hostWorkspaceDir]
        })
      } catch (error) {
        console.warn(`Failed to cleanup workspace directory: ${hostWorkspaceDir}`)
      }

      console.log(`Cleaned up container and files for task ${taskId}`)
    } catch (error) {
      console.error(`Error cleaning up task container for ${taskId}:`, error)
    }
  }
}

// Instance par défaut
const defaultTaskContainerManager = new TaskContainerManager()

/**
 * Crée un environnement Docker pour une tâche
 */
export async function createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
  return defaultTaskContainerManager.createTaskContainer(options)
}

/**
 * Exécute une commande Claude dans un conteneur de tâche
 */
export async function executeClaudeInTask(taskId: string, prompt: string): Promise<string> {
  const task = await TaskModel.findById(taskId)
  if (!task || !task.dockerId) {
    throw new Error(`Task ${taskId} has no associated container`)
  }

  return defaultTaskContainerManager.executeClaudeCommand(task.dockerId, prompt)
}

/**
 * Nettoie le conteneur d'une tâche
 */
export async function cleanupTaskContainer(taskId: string): Promise<void> {
  return defaultTaskContainerManager.cleanupTaskContainer(taskId)
}