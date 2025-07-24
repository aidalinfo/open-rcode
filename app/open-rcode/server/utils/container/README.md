# Container Abstraction Layer

This module provides an abstraction layer that allows CCWeb to run tasks in either Docker containers or Kubernetes pods, depending on the deployment environment.

## Architecture

The container abstraction layer follows a factory pattern with clear interfaces:

```
container/
├── interfaces/           # Common interfaces for all implementations
├── docker/              # Docker-specific implementation
├── kubernetes/          # Kubernetes-specific implementation
├── shared/              # Shared utilities
└── factory/             # Factory for provider selection
```

## Configuration

### Docker Mode (Default)

By default, CCWeb uses Docker containers:

```bash
# No special configuration needed - Docker is the default
npm run dev
```

### Kubernetes Mode

To use Kubernetes instead of Docker:

```bash
# Set the MODE environment variable
MODE=KUBERNETES npm run dev

# Optional: specify namespace
MODE=KUBERNETES KUBERNETES_NAMESPACE=ccweb npm run dev

# Optional: specify custom kubeconfig
MODE=KUBERNETES KUBECONFIG=/path/to/kubeconfig npm run dev
```

## Environment Variables

- `MODE`: Set to `KUBERNETES` to use Kubernetes instead of Docker
- `KUBERNETES_NAMESPACE`: Kubernetes namespace to use (default: `default`)
- `KUBECONFIG`: Path to kubeconfig file (uses default if not specified)
- `TASK_RUNNER_IMAGE`: Custom task runner image (default: `ghcr.io/killian-aidalinfo/ccweb-task-runner:latest`)

## Key Differences

### Docker
- Uses local Docker daemon
- Containers run on the same host
- Volume mounts for workspace
- Direct container lifecycle management

### Kubernetes
- Uses Kubernetes API
- Pods can run on any node in the cluster
- EmptyDir volumes for workspace (can be changed to PVC)
- Kubernetes manages pod lifecycle
- Better for production deployments

## Implementation Details

### Interfaces

1. **ContainerManager**: Low-level container/pod operations
   - Create, start, stop, remove containers/pods
   - Execute commands
   - Get logs and status

2. **TaskOrchestrator**: High-level task management
   - Create task environments
   - Execute AI commands
   - Cleanup resources

### Provider Selection

The `ContainerFactory` automatically selects the appropriate provider based on the `MODE` environment variable:

```typescript
import { ContainerFactory } from './container/factory/container-factory';

// Get the appropriate manager
const containerManager = ContainerFactory.getContainerManager();
const taskOrchestrator = ContainerFactory.getTaskOrchestrator();

// Check current provider
if (ContainerFactory.isKubernetes()) {
  console.log('Using Kubernetes');
} else {
  console.log('Using Docker');
}
```

## Kubernetes Requirements

1. **Cluster Access**: The application needs access to a Kubernetes cluster
2. **RBAC Permissions**: The service account needs permissions to:
   - Create/delete pods
   - Read pod status and logs
   - Create/delete configmaps and secrets (if used)

Example RBAC configuration:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ccweb-task-runner
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "pods/exec"]
  verbs: ["get", "list", "create", "delete", "watch"]
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["get", "list", "create", "delete", "watch"]
```

## Migration Guide

To migrate from Docker to Kubernetes:

1. Ensure your Kubernetes cluster is accessible
2. Set up RBAC permissions
3. Build and push the task runner image to a registry
4. Set `MODE=KUBERNETES` environment variable
5. Start the application

The application will automatically use Kubernetes for all container operations.

## Monitoring

Both Docker and Kubernetes modes support:
- Container/pod status monitoring
- Automatic cleanup of completed tasks
- Log retrieval
- Resource usage tracking

The monitoring system automatically adapts to the selected provider.

## Troubleshooting

### Kubernetes Connection Issues

If you see "Failed to create pod" errors:
1. Check `kubectl` works: `kubectl get pods`
2. Verify RBAC permissions
3. Check namespace exists
4. Ensure image is accessible from cluster

### Pod Startup Issues

If pods fail to start:
1. Check pod events: `kubectl describe pod ccweb-task-<id>`
2. Verify image pull secrets if using private registry
3. Check resource limits and quotas
4. Review pod logs: `kubectl logs ccweb-task-<id>`