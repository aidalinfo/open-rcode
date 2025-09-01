import Docker from 'dockerode'
import crypto from 'crypto'
import type { ExecuteResult } from './container/base-container-manager'
import { createLogger } from './logger'

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
  private logger = createLogger('DockerManager')

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
      this.logger.error({ error }, 'Docker is not available')
      return false
    }
  }

  /**
   * Génère un nom unique pour le conteneur
   */
  static generateContainerName(prefix: string = 'openrcode'): string {
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
          'openrcode.managed': 'true',
          'openrcode.created': new Date().toISOString()
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
      this.logger.info({ containerId: containerInfo.Id }, 'Container created and started')

      return containerInfo.Id
    } catch (error) {
      this.logger.error({ error }, 'Error creating container')
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
      this.logger.error({ error, containerId: options.containerId }, 'Error executing command in container')
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
      this.logger.info({ containerId }, 'Container stopped')
    } catch (error) {
      this.logger.error({ error, containerId }, 'Error stopping container')
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
      this.logger.info({ containerId }, 'Container removed')
    } catch (error) {
      this.logger.error({ error, containerId }, 'Error removing container')
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
        ports: data.NetworkSettings.Ports
          ? Object.entries(data.NetworkSettings.Ports).map(([port, bindings]) => ({
              port,
              bindings
            }))
          : [],
        created: new Date(data.Created),
        labels: data.Config.Labels
      }
    } catch (error) {
      this.logger.debug({ error, containerId }, 'Error getting container info')
      return null
    }
  }

  /**
   * Liste tous les conteneurs gérés par openrcode
   */
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({
        all,
        filters: {
          label: ['openrcode.managed=true']
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
      this.logger.error({ error }, 'Error listing containers')
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
      this.logger.error({ error, containerId }, 'Error getting container logs')
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
      this.logger.debug({ sourcePath, destPath, containerId }, 'Files copied to container')
    } catch (error) {
      this.logger.error({ error, containerId }, 'Error copying files to container')
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
      this.logger.info({ containerId }, 'Container restarted')
    } catch (error) {
      this.logger.error({ error, containerId }, 'Error restarting container')
      throw new Error(`Failed to restart container: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Nettoie tous les conteneurs openrcode arrêtés
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
          this.logger.warn({ containerId: container.id, error }, 'Failed to remove container during cleanup')
        }
      }

      this.logger.info({ cleanedCount }, 'Cleaned up containers')
      return cleanedCount
    } catch (error) {
      this.logger.error({ error }, 'Error cleaning up containers')
      return 0
    }
  }
}
