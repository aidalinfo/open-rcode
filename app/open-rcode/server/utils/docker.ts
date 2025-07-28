import Docker from 'dockerode'
import crypto from 'crypto'
import type { ExecuteResult } from './container/base-container-manager'

export interface DockerContainerOptions {
  image: string
  name?: string
  workdir?: string
  environment?: Record<string, string>
  volumes?: string[]
  ports?: Record<string, string>
  command?: string[]
  autoRemove?: boolean
  networkMode?: string
  restartPolicy?: 'no' | 'always' | 'unless-stopped' | 'on-failure'
}

export interface DockerExecuteOptions {
  containerId: string
  command: string[]
  workdir?: string
  environment?: Record<string, string>
  user?: string
  attachStdout?: boolean
  attachStderr?: boolean
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: any[]
  created: Date
  labels?: Record<string, string>
}


export interface DockerConnectionOptions {
  socketPath?: string
  host?: string
  port?: number
  protocol?: 'http' | 'https'
  ca?: string
  cert?: string
  key?: string
  version?: string
}

export class DockerManager {
  private docker: Docker

  constructor(options?: DockerConnectionOptions) {
    // Initialise Docker avec les options personnalisées ou par défaut
    if (options) {
      this.docker = new Docker(options)
    } else {
      // Configuration par défaut (socket locale)
      this.docker = new Docker()
    }
  }

  /**
   * Crée une nouvelle instance DockerManager avec un hôte spécifique
   */
  static createWithHost(host: string, port: number = 2376, protocol: 'http' | 'https' = 'http'): DockerManager {
    return new DockerManager({
      host,
      port,
      protocol
    })
  }

  /**
   * Crée une nouvelle instance DockerManager avec une socket spécifique
   */
  static createWithSocket(socketPath: string): DockerManager {
    return new DockerManager({
      socketPath
    })
  }

  /**
   * Crée une nouvelle instance DockerManager avec authentification TLS
   */
  static createWithTLS(host: string, port: number, ca: string, cert: string, key: string): DockerManager {
    return new DockerManager({
      host,
      port,
      protocol: 'https',
      ca,
      cert,
      key
    })
  }

  /**
   * Crée une nouvelle instance DockerManager à partir d'une URL
   */
  static createFromUrl(url: string): DockerManager {
    const urlObj = new URL(url)
    return new DockerManager({
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 2376 : 2375),
      protocol: urlObj.protocol === 'https:' ? 'https' : 'http'
    })
  }

  /**
   * Retourne les informations de connexion actuelles
   */
  getConnectionInfo(): DockerConnectionOptions {
    return {
      host: (this.docker as any).modem.host,
      port: (this.docker as any).modem.port,
      protocol: (this.docker as any).modem.protocol,
      socketPath: (this.docker as any).modem.socketPath
    }
  }

  /**
   * Obtient l'instance Docker pour des opérations avancées
   */
  getDockerInstance(): Docker {
    return this.docker
  }

  /**
   * Vérifie si Docker est disponible et en cours d'exécution
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping()
      return true
    } catch (error) {
      if (process.dev) console.error('Docker is not available:', error)
      return false
    }
  }

  /**
   * Génère un nom unique pour le conteneur
   */
  static generateContainerName(prefix: string = 'ccweb'): string {
    const randomId = crypto.randomBytes(8).toString('hex')
    return `${prefix}-${randomId}`
  }

  /**
   * Crée et démarre un nouveau conteneur
   */
  async createContainer(options: DockerContainerOptions): Promise<string> {
    try {
      const containerName = options.name || DockerManager.generateContainerName()

      // Configuration du conteneur
      const createOptions: any = {
        Image: options.image,
        name: containerName,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        OpenStdin: false,
        StdinOnce: false,
        HostConfig: {
          AutoRemove: options.autoRemove === true,
          RestartPolicy: {
            Name: options.restartPolicy || 'no'
          }
        },
        Labels: {
          'ccweb.managed': 'true',
          'ccweb.created': new Date().toISOString()
        }
      }

      // Répertoire de travail
      if (options.workdir) {
        createOptions.WorkingDir = options.workdir
      }

      // Variables d'environnement
      if (options.environment) {
        createOptions.Env = Object.entries(options.environment).map(
          ([key, value]) => `${key}=${value}`
        )
      }

      // Commande
      if (options.command) {
        createOptions.Cmd = options.command
      }

      // Volumes
      if (options.volumes) {
        createOptions.HostConfig.Binds = options.volumes
      }

      // Ports
      if (options.ports) {
        const exposedPorts: any = {}
        const portBindings: any = {}
        
        Object.entries(options.ports).forEach(([containerPort, hostPort]) => {
          exposedPorts[`${containerPort}/tcp`] = {}
          portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }]
        })
        
        createOptions.ExposedPorts = exposedPorts
        createOptions.HostConfig.PortBindings = portBindings
      }

      // Mode réseau
      if (options.networkMode) {
        createOptions.HostConfig.NetworkMode = options.networkMode
      }

      // Créer le conteneur
      const container = await this.docker.createContainer(createOptions)
      
      // Démarrer le conteneur
      await container.start()
      
      const containerInfo = await container.inspect()
      if (process.dev) console.log(`Container created and started: ${containerInfo.Id}`)
      
      return containerInfo.Id
    } catch (error) {
      if (process.dev) console.error('Error creating container:', error)
      throw new Error(`Failed to create container: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Exécute une commande dans un conteneur existant
   */
  async executeInContainer(options: DockerExecuteOptions): Promise<ExecuteResult> {
    try {
      const container = this.docker.getContainer(options.containerId)

      const execOptions: any = {
        Cmd: options.command,
        AttachStdout: options.attachStdout !== false,
        AttachStderr: options.attachStderr !== false,
        AttachStdin: false,
        Tty: false
      }

      // Répertoire de travail
      if (options.workdir) {
        execOptions.WorkingDir = options.workdir
      }

      // Utilisateur
      if (options.user) {
        execOptions.User = options.user
      }

      // Variables d'environnement
      if (options.environment) {
        execOptions.Env = Object.entries(options.environment).map(
          ([key, value]) => `${key}=${value}`
        )
      }

      // Créer l'exécution
      const exec = await container.exec(execOptions)
      
      // Démarrer l'exécution
      const stream = await exec.start({ hijack: true, stdin: false })
      
      let stdout = ''
      let stderr = ''

      // Traiter le stream
      await new Promise<void>((resolve, reject) => {
        const stdoutStream = {
          write: (chunk: Buffer) => {
            stdout += chunk.toString()
          }
        }
        
        const stderrStream = {
          write: (chunk: Buffer) => {
            stderr += chunk.toString()
          }
        }
        
        this.docker.modem.demuxStream(stream, stdoutStream as any, stderrStream as any)

        stream.on('end', resolve)
        stream.on('error', reject)
      })

      // Récupérer le code de sortie
      const inspectResult = await exec.inspect()
      const exitCode = inspectResult.ExitCode || 0

      return { stdout, stderr, exitCode }
    } catch (error) {
      if (process.dev) console.error('Error executing command in container:', error)
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Arrête un conteneur
   */
  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId)
      await container.stop({ t: timeout })
      if (process.dev) console.log(`Container stopped: ${containerId}`)
    } catch (error) {
      if (process.dev) console.error('Error stopping container:', error)
      throw new Error(`Failed to stop container: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Supprime un conteneur
   */
  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId)
      await container.remove({ force })
      if (process.dev) console.log(`Container removed: ${containerId}`)
    } catch (error) {
      if (process.dev) console.error('Error removing container:', error)
      throw new Error(`Failed to remove container: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Récupère les informations d'un conteneur
   */
  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const container = this.docker.getContainer(containerId)
      const data = await container.inspect()
      
      return {
        id: data.Id,
        name: data.Name.replace('/', ''),
        image: data.Config.Image,
        status: data.State.Status,
        state: data.State.Status,
        ports: data.NetworkSettings.Ports ? Object.entries(data.NetworkSettings.Ports).map(([port, bindings]) => ({
          port,
          bindings
        })) : [],
        created: new Date(data.Created),
        labels: data.Config.Labels
      }
    } catch (error) {
      if (process.dev) console.error('Error getting container info:', error)
      return null
    }
  }

  /**
   * Liste tous les conteneurs gérés par ccweb
   */
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ 
        all,
        filters: {
          label: ['ccweb.managed=true']
        }
      })
      
      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        status: container.Status,
        state: container.State,
        ports: container.Ports.map(port => ({
          privatePort: port.PrivatePort,
          publicPort: port.PublicPort,
          type: port.Type
        })),
        created: new Date(container.Created * 1000),
        labels: container.Labels
      }))
    } catch (error) {
      if (process.dev) console.error('Error listing containers:', error)
      return []
    }
  }

  /**
   * Récupère les logs d'un conteneur
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId)
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true
      })
      
      return stream.toString()
    } catch (error) {
      if (process.dev) console.error('Error getting container logs:', error)
      throw new Error(`Failed to get container logs: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Copie des fichiers vers un conteneur
   */
  async copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId)
      
      // Créer un stream depuis le fichier source
      const fs = await import('fs')
      const path = await import('path')
      const tar = await import('tar-stream') as any
      
      const pack = tar.pack()
      const fileName = path.basename(sourcePath)
      const fileContent = fs.readFileSync(sourcePath)
      
      pack.entry({ name: fileName }, fileContent)
      pack.finalize()
      
      await container.putArchive(pack, { path: destPath })
      if (process.dev) console.log(`Files copied to container: ${sourcePath} -> ${destPath}`)
    } catch (error) {
      if (process.dev) console.error('Error copying files to container:', error)
      throw new Error(`Failed to copy files to container: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Redémarre un conteneur
   */
  async restartContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId)
      await container.restart({ t: timeout })
      if (process.dev) console.log(`Container restarted: ${containerId}`)
    } catch (error) {
      if (process.dev) console.error('Error restarting container:', error)
      throw new Error(`Failed to restart container: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Nettoie tous les conteneurs ccweb arrêtés
   */
  async cleanupContainers(): Promise<number> {
    try {
      const containers = await this.listContainers(true)
      const stoppedContainers = containers.filter(c => c.state !== 'running')
      
      let cleanedCount = 0
      for (const container of stoppedContainers) {
        try {
          await this.removeContainer(container.id, true)
          cleanedCount++
        } catch (error) {
          if (process.dev) console.error(`Failed to remove container ${container.id}:`, error)
        }
      }
      
      if (process.dev) console.log(`Cleaned up ${cleanedCount} containers`)
      return cleanedCount
    } catch (error) {
      if (process.dev) console.error('Error cleaning up containers:', error)
      return 0
    }
  }
}