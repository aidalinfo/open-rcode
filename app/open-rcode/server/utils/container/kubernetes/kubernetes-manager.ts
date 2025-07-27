import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import type { ExecuteResult } from '../base-container-manager'

const execAsync = promisify(exec)

export interface KubernetesContainerOptions {
  image: string
  name?: string
  workdir?: string
  environment?: Record<string, string>
  ports?: Record<string, string>
  command?: string[]
  namespace?: string
  restartPolicy?: 'Never' | 'OnFailure' | 'Always'
  serviceAccount?: string
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

export interface KubernetesExecuteOptions {
  podName: string
  command: string[]
  workdir?: string
  environment?: Record<string, string>
  namespace?: string
  container?: string
}

export interface PodInfo {
  name: string
  namespace: string
  image: string
  status: string
  phase: string
  created: Date
  labels?: Record<string, string>
  containers: ContainerStatus[]
}

export interface ContainerStatus {
  name: string
  image: string
  ready: boolean
  state: string
  restartCount: number
}


export interface KubernetesConnectionOptions {
  kubeconfig?: string
  context?: string
  namespace?: string
  server?: string
  token?: string
  certificateAuthority?: string
}

export class KubernetesManager {
  private defaultNamespace: string
  private context?: string
  private kubeconfig?: string

  constructor(options?: KubernetesConnectionOptions) {
    this.defaultNamespace = options?.namespace || 'default'
    this.context = options?.context
    this.kubeconfig = options?.kubeconfig
    
    console.log(`☸️ Kubernetes Manager initialized:`)
    console.log(`   Namespace: ${this.defaultNamespace}`)
    if (this.context) console.log(`   Context: ${this.context}`)
    if (this.kubeconfig) console.log(`   Kubeconfig: ${this.kubeconfig}`)
  }

  static createWithKubeconfig(kubeconfigPath: string, context?: string): KubernetesManager {
    return new KubernetesManager({
      kubeconfig: kubeconfigPath,
      context
    })
  }

  static createWithToken(server: string, token: string, ca?: string): KubernetesManager {
    return new KubernetesManager({
      server,
      token,
      certificateAuthority: ca
    })
  }

  static createWithContext(context: string, namespace?: string): KubernetesManager {
    return new KubernetesManager({
      context,
      namespace
    })
  }

  getConnectionInfo(): KubernetesConnectionOptions {
    return {
      kubeconfig: this.kubeconfig,
      context: this.context,
      namespace: this.defaultNamespace
    }
  }

  private buildKubectlCommand(args: string[]): string {
    let cmd = 'kubectl'
    
    if (this.kubeconfig) {
      cmd += ` --kubeconfig="${this.kubeconfig}"`
    }
    
    if (this.context) {
      cmd += ` --context="${this.context}"`
    }
    
    return `${cmd} ${args.join(' ')}`
  }

  private async executeKubectlWithStdin(args: string[], input: string): Promise<{ stdout: string; stderr: string }> {
    console.log(`🔧 Executing kubectl with stdin: ${args.join(' ')}`)
    
    return new Promise((resolve, reject) => {
      const kubectlArgs = ['kubectl']
      
      if (this.kubeconfig) {
        kubectlArgs.push(`--kubeconfig=${this.kubeconfig}`)
      }
      
      if (this.context) {
        kubectlArgs.push(`--context=${this.context}`)
      }
      
      kubectlArgs.push(...args)

      const process = spawn(kubectlArgs[0], kubectlArgs.slice(1))
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      process.on('close', (code) => {
        console.log(`📊 kubectl process closed with code: ${code}`)
        if (stdout) console.log(`📤 stdout: ${stdout.substring(0, 200)}...`)
        if (stderr) console.log(`📤 stderr: ${stderr.substring(0, 200)}...`)
        
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`kubectl command failed with code ${code}: ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error(`❌ kubectl process error:`, error)
        reject(error)
      })
      
      // Envoyer les données en stdin
      process.stdin.write(input)
      process.stdin.end()
    })
  }

  async isKubernetesAvailable(): Promise<boolean> {
    try {
      console.log('☸️ Checking Kubernetes cluster connectivity...')
      const cmd = this.buildKubectlCommand(['cluster-info'])
      const { stdout } = await execAsync(cmd)
      console.log('✅ Kubernetes cluster is available')
      console.log(`📋 Cluster info: ${stdout.split('\n')[0]}`) // Premier ligne du cluster-info
      return true
    } catch (error) {
      console.error('❌ Kubernetes is not available:', error)
      return false
    }
  }

  static generatePodName(prefix: string = 'ccweb'): string {
    const randomId = crypto.randomBytes(8).toString('hex')
    return `${prefix}-${randomId}`
  }

  private createPodManifest(options: KubernetesContainerOptions): any {
    const podName = options.name || KubernetesManager.generatePodName()
    const namespace = options.namespace || this.defaultNamespace

    const manifest = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        namespace,
        labels: {
          'ccweb.managed': 'true',
          'ccweb.created': new Date().toISOString().replace(/[:.]/g, '-')
        }
      },
      spec: {
        restartPolicy: options.restartPolicy || 'Never',
        containers: [{
          name: 'main',
          image: 'rg.fr-par.scw.cloud/aidalinfo-public/ccweb:latest',
          workingDir: options.workdir,
          env: options.environment ? Object.entries(options.environment).map(
            ([name, value]) => ({ name, value })
          ) : undefined,
          command: options.command,
          ports: options.ports ? Object.keys(options.ports).map(port => ({
            containerPort: parseInt(port),
            protocol: 'TCP'
          })) : undefined,
          resources: options.resources
        }],
        serviceAccount: options.serviceAccount
      }
    }

    // Nettoyer les propriétés undefined
    return JSON.parse(JSON.stringify(manifest))
  }

  async createPod(options: KubernetesContainerOptions): Promise<string> {
    try {
      const manifest = this.createPodManifest(options)
      const manifestJson = JSON.stringify(manifest)
      const podName = manifest.metadata.name
      const namespace = manifest.metadata.namespace
      
      console.log(`☸️ Creating Kubernetes pod: ${podName} in namespace: ${namespace}`)
      console.log(`📦 Using image: rg.fr-par.scw.cloud/aidalinfo-public/ccweb:latest`)
      
      // Appliquer le manifest
      try {
        await this.executeKubectlWithStdin(['apply', '-f', '-'], manifestJson)
        console.log(`✅ Pod manifest applied successfully`)
      } catch (applyError) {
        console.error(`❌ Failed to apply pod manifest:`, applyError)
        throw applyError
      }
      
      // Attendre que le pod soit prêt
      console.log(`⏳ Waiting for pod to be ready...`)
      await this.waitForPodReady(podName, namespace)
      
      console.log(`🚀 Pod created and ready: ${podName}`)
      return podName
    } catch (error) {
      console.error('❌ Error creating pod:', error)
      throw new Error(`Failed to create pod: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async waitForPodReady(podName: string, namespace: string, timeout: number = 900): Promise<void> {
    const startTime = Date.now()
    let lastStatus = ''
    
    while (Date.now() - startTime < timeout * 1000) {
      try {
        const podInfo = await this.getPodInfo(podName, namespace)
        if (podInfo) {
          const currentStatus = `${podInfo.phase}${podInfo.containers.length > 0 ? ` (${podInfo.containers.filter(c => c.ready).length}/${podInfo.containers.length} ready)` : ''}`
          
          if (currentStatus !== lastStatus) {
            console.log(`📊 Pod status: ${currentStatus}`)
            lastStatus = currentStatus
          }
          
          if (podInfo.phase === 'Running') {
            const readyContainers = podInfo.containers.filter(c => c.ready).length
            if (readyContainers === podInfo.containers.length) {
              console.log(`✅ All containers are ready`)
              return
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    console.error(`⏰ Timeout: Pod ${podName} did not become ready within ${timeout} seconds`)
    throw new Error(`Pod ${podName} did not become ready within ${timeout} seconds`)
  }

  async executeInPodWithStreaming(options: KubernetesExecuteOptions, onOutput?: (data: string) => void): Promise<ExecuteResult> {
    return new Promise((resolve, reject) => {
      const namespace = options.namespace || this.defaultNamespace
      const container = options.container || 'main'
      
      console.log(`🔧 Executing command in pod ${options.podName} (streaming): ${options.command.join(' ')}`)
      console.log(`⏳ Command may take up to 30 minutes to complete...`)
      
      const kubectlArgs = ['kubectl']
      
      if (this.kubeconfig) {
        kubectlArgs.push(`--kubeconfig=${this.kubeconfig}`)
      }
      
      if (this.context) {
        kubectlArgs.push(`--context=${this.context}`)
      }
      
      kubectlArgs.push('exec', options.podName, '-n', namespace, '-c', container, '--')
      kubectlArgs.push(...options.command)

      const process = spawn(kubectlArgs[0], kubectlArgs.slice(1))
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        if (onOutput) {
          onOutput(output)
        }
      })
      
      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        if (onOutput) {
          onOutput(output)
        }
      })
      
      const timeout = setTimeout(() => {
        process.kill('SIGTERM')
        resolve({
          stdout,
          stderr: stderr + '\nCommand timed out after 15 minutes',
          exitCode: 124
        })
      }, 900000) // 15 minutes timeout
      
      process.on('close', (code) => {
        clearTimeout(timeout)
        console.log(`📊 kubectl process closed with code: ${code}`)
        
        if (code === 0) {
          console.log(`✅ Command executed successfully`)
        } else {
          console.log(`⚠️ Command failed with exit code ${code}`)
        }
        
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        })
      })
      
      process.on('error', (error) => {
        clearTimeout(timeout)
        console.error(`❌ kubectl process error:`, error)
        reject(error)
      })
    })
  }

  async executeInPod(options: KubernetesExecuteOptions): Promise<ExecuteResult> {
    try {
      const namespace = options.namespace || this.defaultNamespace
      const container = options.container || 'main'
      
      console.log(`🔧 Executing command in pod ${options.podName}: ${options.command.join(' ')}`)
      console.log(`⏳ Command may take up to 30 minutes to complete...`)
      
      let execArgs = ['exec', options.podName, '-n', namespace, '-c', container, '--']
      execArgs = execArgs.concat(options.command)
      
      const cmd = this.buildKubectlCommand(execArgs)
      
      
      try {
        // Use spawn instead of execAsync to handle complex commands properly
        const result = await new Promise<ExecuteResult>((resolve, reject) => {
          const kubectlArgs = ['kubectl']
          
          if (this.kubeconfig) {
            kubectlArgs.push(`--kubeconfig=${this.kubeconfig}`)
          }
          
          if (this.context) {
            kubectlArgs.push(`--context=${this.context}`)
          }
          
          kubectlArgs.push('exec', options.podName, '-n', namespace, '-c', container, '--')
          kubectlArgs.push(...options.command)

          const process = spawn(kubectlArgs[0], kubectlArgs.slice(1))
          
          let stdout = ''
          let stderr = ''
          
          process.stdout.on('data', (data) => {
            stdout += data.toString()
          })
          
          process.stderr.on('data', (data) => {
            stderr += data.toString()
          })
          
          const timeout = setTimeout(() => {
            process.kill('SIGTERM')
            resolve({
              stdout,
              stderr: stderr + '\nCommand timed out after 30 minutes',
              exitCode: 124
            })
          }, 1800000) // 30 minutes timeout
          
          process.on('close', (code) => {
            clearTimeout(timeout)
            console.log(`✅ kubectl process closed with code: ${code}`)
            resolve({
              stdout,
              stderr,
              exitCode: code || 0
            })
          })
          
          process.on('error', (error) => {
            clearTimeout(timeout)
            console.error(`❌ kubectl process error:`, error)
            reject(error)
          })
        })

        console.log(`✅ Command executed successfully`)
        return result
      } catch (error: any) {
        console.log(`⚠️ Command failed: ${error}`)
        throw error
      }
    } catch (error) {
      console.error('❌ Error executing command in pod:', error)
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async deletePod(podName: string, namespace?: string): Promise<void> {
    try {
      const ns = namespace || this.defaultNamespace
      console.log(`🗑️ Deleting pod: ${podName} from namespace: ${ns}`)
      const cmd = this.buildKubectlCommand(['delete', 'pod', podName, '-n', ns, '--force', '--grace-period=0'])
      await execAsync(cmd)
      console.log(`✅ Pod deleted: ${podName}`)
    } catch (error) {
      console.error('❌ Error deleting pod:', error)
      throw new Error(`Failed to delete pod: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async getPodInfo(podName: string, namespace?: string): Promise<PodInfo | null> {
    try {
      const ns = namespace || this.defaultNamespace
      const cmd = this.buildKubectlCommand(['get', 'pod', podName, '-n', ns, '-o', 'json'])
      const { stdout } = await execAsync(cmd)
      
      const podData = JSON.parse(stdout)
      
      return {
        name: podData.metadata.name,
        namespace: podData.metadata.namespace,
        image: podData.spec.containers[0].image,
        status: podData.status.phase,
        phase: podData.status.phase,
        created: new Date(podData.metadata.creationTimestamp),
        labels: podData.metadata.labels,
        containers: podData.status.containerStatuses?.map((container: any) => ({
          name: container.name,
          image: container.image,
          ready: container.ready,
          state: Object.keys(container.state)[0],
          restartCount: container.restartCount
        })) || []
      }
    } catch (error) {
      console.error('Error getting pod info:', error)
      return null
    }
  }

  async listPods(namespace?: string, labelSelector?: string): Promise<PodInfo[]> {
    try {
      const ns = namespace || this.defaultNamespace
      let args = ['get', 'pods', '-n', ns, '-o', 'json']
      
      if (labelSelector) {
        args.push('-l', labelSelector)
      } else {
        args.push('-l', 'ccweb.managed=true')
      }
      
      const cmd = this.buildKubectlCommand(args)
      const { stdout } = await execAsync(cmd)
      
      const podsData = JSON.parse(stdout)
      
      return podsData.items.map((pod: any) => ({
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        image: pod.spec.containers[0].image,
        status: pod.status.phase,
        phase: pod.status.phase,
        created: new Date(pod.metadata.creationTimestamp),
        labels: pod.metadata.labels,
        containers: pod.status.containerStatuses?.map((container: any) => ({
          name: container.name,
          image: container.image,
          ready: container.ready,
          state: Object.keys(container.state)[0],
          restartCount: container.restartCount
        })) || []
      }))
    } catch (error) {
      console.error('Error listing pods:', error)
      return []
    }
  }

  async getPodLogs(podName: string, namespace?: string, tail: number = 100, container?: string): Promise<string> {
    try {
      const ns = namespace || this.defaultNamespace
      let args = ['logs', podName, '-n', ns, `--tail=${tail}`, '--timestamps']
      
      if (container) {
        args.push('-c', container)
      }
      
      const cmd = this.buildKubectlCommand(args)
      const { stdout } = await execAsync(cmd)
      
      return stdout
    } catch (error) {
      console.error('Error getting pod logs:', error)
      throw new Error(`Failed to get pod logs: ${error instanceof Error ? error.message : String(error)}`)
    }
  }


  async restartPod(podName: string, namespace?: string): Promise<void> {
    try {
      // Dans Kubernetes, on ne peut pas redémarrer un pod directement
      // On doit le supprimer et le recréer (si géré par un déploiement)
      // ou utiliser kubectl rollout restart pour les déploiements
      const ns = namespace || this.defaultNamespace
      
      // Obtenir le manifest du pod existant
      const getCmd = this.buildKubectlCommand(['get', 'pod', podName, '-n', ns, '-o', 'yaml'])
      const { stdout } = await execAsync(getCmd)
      
      // Supprimer le pod
      await this.deletePod(podName, namespace)
      
      // Attendre un peu
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Recréer le pod
      await this.executeKubectlWithStdin(['apply', '-f', '-'], stdout)
      
      console.log(`Pod restarted: ${podName}`)
    } catch (error) {
      console.error('Error restarting pod:', error)
      throw new Error(`Failed to restart pod: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async cleanupPods(namespace?: string): Promise<number> {
    try {
      const pods = await this.listPods(namespace)
      const stoppedPods = pods.filter(p => p.phase !== 'Running')
      
      let cleanedCount = 0
      for (const pod of stoppedPods) {
        try {
          await this.deletePod(pod.name, pod.namespace)
          cleanedCount++
        } catch (error) {
          console.error(`Failed to remove pod ${pod.name}:`, error)
        }
      }
      
      console.log(`Cleaned up ${cleanedCount} pods`)
      return cleanedCount
    } catch (error) {
      console.error('Error cleaning up pods:', error)
      return 0
    }
  }

  async createService(podName: string, ports: Record<string, string>, namespace?: string): Promise<string> {
    try {
      const ns = namespace || this.defaultNamespace
      const serviceName = `${podName}-service`
      
      const serviceManifest = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: serviceName,
          namespace: ns,
          labels: {
            'ccweb.managed': 'true'
          }
        },
        spec: {
          selector: {
            'ccweb.managed': 'true'
          },
          ports: Object.entries(ports).map(([containerPort, hostPort]) => ({
            port: parseInt(hostPort),
            targetPort: parseInt(containerPort),
            protocol: 'TCP'
          })),
          type: 'ClusterIP'
        }
      }
      
      const manifestJson = JSON.stringify(serviceManifest)
      await this.executeKubectlWithStdin(['apply', '-f', '-'], manifestJson)
      
      console.log(`Service created: ${serviceName}`)
      return serviceName
    } catch (error) {
      console.error('Error creating service:', error)
      throw new Error(`Failed to create service: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async deleteService(serviceName: string, namespace?: string): Promise<void> {
    try {
      const ns = namespace || this.defaultNamespace
      const cmd = this.buildKubectlCommand(['delete', 'service', serviceName, '-n', ns])
      await execAsync(cmd)
      console.log(`Service deleted: ${serviceName}`)
    } catch (error) {
      console.error('Error deleting service:', error)
      throw new Error(`Failed to delete service: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}