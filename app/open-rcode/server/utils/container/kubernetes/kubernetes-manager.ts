import * as k8s from '@kubernetes/client-node';
import { Readable } from 'stream';
import type { 
  ContainerManager, 
  ContainerOptions, 
  ExecuteOptions, 
  ExecuteResult, 
  ContainerInfo 
} from '../interfaces/container-manager.interface';
import { K8sClient } from './k8s-client';

export class KubernetesManager implements ContainerManager {
  private k8sClient: K8sClient;
  private namespace: string;
  private podPrefix = 'ccweb-task-';

  constructor(kubeconfig?: string, namespace = 'default') {
    this.k8sClient = new K8sClient(kubeconfig);
    this.namespace = namespace;
  }

  async createContainer(options: ContainerOptions): Promise<string> {
    const podName = options.name || `${this.podPrefix}${Date.now()}`;
    
    const pod: k8s.V1Pod = {
      metadata: {
        name: podName,
        namespace: this.namespace,
        labels: {
          app: 'ccweb',
          ...options.labels
        }
      },
      spec: {
        containers: [{
          name: 'task-runner',
          image: options.image,
          workingDir: options.workingDir,
          env: this.buildEnvVars(options.env),
          resources: {
            limits: {
              memory: options.memory || '2Gi',
              cpu: String(options.cpus || 2)
            },
            requests: {
              memory: '512Mi',
              cpu: '0.5'
            }
          },
          volumeMounts: this.buildVolumeMounts(options.volumes),
          command: ['/bin/sh', '-c', 'sleep infinity']
        }],
        volumes: this.buildVolumes(options.volumes),
        restartPolicy: 'Never'
      }
    };

    try {
      const response = await this.k8sClient.getCoreApi().createNamespacedPod({
        namespace: this.namespace,
        body: pod
      });
      return response.body.metadata?.name || podName;
    } catch (error) {
      console.error('Failed to create pod:', error);
      throw new Error(`Failed to create Kubernetes pod: ${error}`);
    }
  }

  async startContainer(containerId: string): Promise<void> {
    // Pods start automatically in Kubernetes
    await this.waitForPodReady(containerId);
  }

  async executeInContainer(options: ExecuteOptions): Promise<ExecuteResult> {
    const exec = new k8s.Exec(this.k8sClient.getKubeConfig());
    
    let stdout = '';
    let stderr = '';
    
    const stdoutStream = new Readable({
      read() {}
    });
    
    const stderrStream = new Readable({
      read() {}
    });

    stdoutStream.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    stderrStream.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        exec.exec(
          this.namespace,
          options.containerId,
          'task-runner',
          options.command,
          stdoutStream,
          stderrStream,
          null,
          false,
          (status) => {
            if (status.status === 'Success') {
              resolve(0);
            } else {
              resolve(status.code || 1);
            }
          }
        ).catch(reject);
      });

      return { stdout, stderr, exitCode };
    } catch (error) {
      console.error('Failed to execute in pod:', error);
      throw new Error(`Failed to execute command in pod: ${error}`);
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      await this.k8sClient.getCoreApi().deleteNamespacedPod({
        name: containerId,
        namespace: this.namespace,
        body: {} as k8s.V1DeleteOptions
      });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw new Error(`Failed to stop pod: ${error}`);
      }
    }
  }

  async removeContainer(containerId: string): Promise<void> {
    // In Kubernetes, stop and remove are the same operation
    await this.stopContainer(containerId);
  }

  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const response = await this.k8sClient.getCoreApi().readNamespacedPod({
        name: containerId,
        namespace: this.namespace
      });
      
      const pod = response.body;
      return {
        id: pod.metadata?.name || containerId,
        name: pod.metadata?.name || containerId,
        state: this.mapPodPhaseToState(pod.status?.phase),
        labels: pod.metadata?.labels,
        createdAt: pod.metadata?.creationTimestamp ? new Date(pod.metadata.creationTimestamp) : undefined
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async listContainers(filters?: { label?: string[] }): Promise<ContainerInfo[]> {
    let labelSelector = 'app=ccweb';
    if (filters?.label) {
      labelSelector = filters.label.join(',');
    }

    try {
      const response = await this.k8sClient.getCoreApi().listNamespacedPod({
        namespace: this.namespace,
        labelSelector
      });

      return response.body.items.map(pod => ({
        id: pod.metadata?.name || '',
        name: pod.metadata?.name || '',
        state: this.mapPodPhaseToState(pod.status?.phase),
        labels: pod.metadata?.labels,
        createdAt: pod.metadata?.creationTimestamp ? new Date(pod.metadata.creationTimestamp) : undefined
      }));
    } catch (error) {
      console.error('Failed to list pods:', error);
      return [];
    }
  }

  async getContainerLogs(containerId: string, options?: { tail?: number }): Promise<string> {
    try {
      const response = await this.k8sClient.getCoreApi().readNamespacedPodLog({
        name: containerId,
        namespace: this.namespace,
        container: 'task-runner',
        tailLines: options?.tail
      });
      return response.body;
    } catch (error) {
      console.error('Failed to get pod logs:', error);
      return '';
    }
  }

  async waitForContainer(containerId: string): Promise<number> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const info = await this.getContainerInfo(containerId);
      if (!info) {
        return 1; // Pod not found
      }

      if (info.state === 'stopped') {
        // Get the exit code from the pod
        const response = await this.k8sClient.getCoreApi().readNamespacedPod({
          name: containerId,
          namespace: this.namespace
        });
        
        const containerStatus = response.body.status?.containerStatuses?.find(
          cs => cs.name === 'task-runner'
        );
        
        if (containerStatus?.state?.terminated) {
          return containerStatus.state.terminated.exitCode || 0;
        }
        return 0;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Timeout waiting for pod ${containerId}`);
  }

  private async waitForPodReady(podName: string): Promise<void> {
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.k8sClient.getCoreApi().readNamespacedPod({
          name: podName,
          namespace: this.namespace
        });

        const pod = response.body;
        if (pod.status?.phase === 'Running' && 
            pod.status.containerStatuses?.every(cs => cs.ready)) {
          return;
        }

        if (pod.status?.phase === 'Failed' || pod.status?.phase === 'Succeeded') {
          throw new Error(`Pod ${podName} is in ${pod.status.phase} state`);
        }
      } catch (error: any) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Timeout waiting for pod ${podName} to be ready`);
  }

  private buildEnvVars(env?: Record<string, string>): k8s.V1EnvVar[] {
    if (!env) return [];
    
    return Object.entries(env).map(([name, value]) => ({
      name,
      value
    }));
  }

  private buildVolumeMounts(volumes?: Array<{ host: string; container: string }>): k8s.V1VolumeMount[] {
    if (!volumes) return [];
    
    return volumes.map((vol, index) => ({
      name: `volume-${index}`,
      mountPath: vol.container
    }));
  }

  private buildVolumes(volumes?: Array<{ host: string; container: string }>): k8s.V1Volume[] {
    if (!volumes) return [];
    
    return volumes.map((vol, index) => ({
      name: `volume-${index}`,
      emptyDir: {} // Using emptyDir for now, can be changed to PVC if needed
    }));
  }

  private mapPodPhaseToState(phase?: string): 'running' | 'stopped' | 'removing' | 'unknown' {
    switch (phase) {
      case 'Running':
        return 'running';
      case 'Succeeded':
      case 'Failed':
        return 'stopped';
      case 'Terminating':
        return 'removing';
      default:
        return 'unknown';
    }
  }
}