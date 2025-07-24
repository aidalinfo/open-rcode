import * as k8s from '@kubernetes/client-node';

export class K8sClient {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private batchApi: k8s.BatchV1Api;

  constructor(kubeconfig?: string) {
    this.kc = new k8s.KubeConfig();
    
    if (kubeconfig) {
      this.kc.loadFromString(kubeconfig);
    } else {
      this.kc.loadFromDefault();
    }

    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
  }

  getCoreApi(): k8s.CoreV1Api {
    return this.coreApi;
  }

  getBatchApi(): k8s.BatchV1Api {
    return this.batchApi;
  }

  getKubeConfig(): k8s.KubeConfig {
    return this.kc;
  }

  async getNamespaces(): Promise<string[]> {
    try {
      const res = await this.coreApi.listNamespace();
      return res.body.items.map(ns => ns.metadata?.name || '').filter(Boolean);
    } catch (error) {
      console.error('Failed to list namespaces:', error);
      return ['default'];
    }
  }

  async ensureNamespace(namespace: string): Promise<void> {
    try {
      await this.coreApi.readNamespace({ name: namespace });
    } catch (error: any) {
      if (error.statusCode === 404) {
        const ns: k8s.V1Namespace = {
          metadata: { name: namespace }
        };
        await this.coreApi.createNamespace({ body: ns });
      } else {
        throw error;
      }
    }
  }
}