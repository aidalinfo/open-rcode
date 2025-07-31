# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCWeb is a container-based web platform that enables developers to execute AI-assisted programming tasks in isolated containers (Docker or Kubernetes), automatically creating GitHub Pull Requests. Built with Nuxt 4, MongoDB, and supports both Docker and Kubernetes orchestration.

## Development Commands

```bash
# Core development
pnpm dev              # Start development server (http://localhost:3000)
pnpm build           # Production build
pnpm preview         # Preview production build

# Code quality
pnpm lint            # ESLint checking
pnpm typecheck       # TypeScript validation

# Container operations (Docker)
docker build -t ccweb-task-runner:latest server/utils/docker/    # Build task runner image
docker ps -f name=ccweb-task                                     # List active task containers
docker logs <container_id>                                       # View container logs

# Container operations (Kubernetes)
kubectl get pods -l ccweb.managed=true                           # List active task pods
kubectl logs <pod_name>                                          # View pod logs
kubectl delete pod <pod_name>                                    # Delete a pod
```

## Architecture Overview

### Core Workflow
The platform orchestrates AI-assisted development through this flow:
1. User submits task via web interface
2. `TaskContainerManager` creates isolated container (Docker or Kubernetes pod)
3. `ClaudeExecutor` runs AI commands inside container
4. `PullRequestCreator` commits changes and creates GitHub PR

### Container Orchestration
The platform supports two container modes:
- **Docker Mode** (default): Uses Docker containers for task execution
- **Kubernetes Mode**: Uses Kubernetes pods for task execution

Mode is controlled by the `CONTAINER_MODE` environment variable.

### Key Components

**Backend Orchestration (`server/utils/`):**
- `task-container.ts` - Main orchestrator for task execution workflow
- `claude-executor.ts` - Executes Claude Code commands inside containers
- `container-setup.ts` - Configures container environments and runtime dependencies
- `pull-request-creator.ts` - Handles Git operations and GitHub PR creation
- `repository-cloner.ts` - Clones GitHub repositories with authentication

**Container Management (`server/utils/container/`):**
- `container-manager-factory.ts` - Factory for creating Docker or Kubernetes managers
- `base-container-manager.ts` - Base interface for container operations
- `docker-adapter.ts` - Docker implementation adapter
- `kubernetes-adapter.ts` - Kubernetes implementation adapter
- `kubernetes/kubernetes-manager.ts` - Native Kubernetes operations using kubectl

**Data Models (`server/models/`):**
- `Task.ts` - Tracks task execution, Docker containers, and PR status
- `TaskMessage.ts` - Stores conversation history separately from tasks
- `Environment.ts` - Repository-specific development configurations
- `User.ts` - GitHub user profiles with encrypted API keys

**API Structure (`server/api/`):**
- `tasks/` - Task creation and container management endpoints
- `environments/` - CRUD operations for development environments
- `auth/` - GitHub OAuth and GitHub App integration
- `monitoring/` - Container status and cleanup operations

## Critical Implementation Details

### Message Storage System
The system uses dual message storage:
- `Task.messages[]` - Legacy storage for compatibility
- `TaskMessageModel` - Primary storage for conversation threading
- **Important**: Always save user messages to both when creating tasks

### Container Management
Containers persist after task completion for inspection. They accumulate quickly and consume resources.

**Docker Mode:**
- Monitor with: `GET /api/monitoring/containers`
- Cleanup with: `docker stop $(docker ps -q -f name=ccweb-task) && docker rm $(docker ps -aq -f name=ccweb-task)`

**Kubernetes Mode:**
- Monitor with: `kubectl get pods -l ccweb.managed=true`
- Cleanup with: `kubectl delete pods -l ccweb.managed=true`

### AI Provider Configuration
The system supports multiple AI providers through environment variables:
- `claude-oauth` - Uses `CLAUDE_CODE_OAUTH_TOKEN`
- `anthropic-api` - Uses `ANTHROPIC_API_KEY`
- `gemini-cli` - Uses `GEMINI_API_KEY`

Claude Code installation happens in container entrypoint (`server/utils/docker/entrypoint.sh`)

### Container Mode Configuration
Set the container orchestration mode using environment variables:
- `CONTAINER_MODE=docker` (default) - Use Docker containers
- `CONTAINER_MODE=kubernetes` - Use Kubernetes pods
- `KUBERNETES_NAMESPACE` - Kubernetes namespace (default: "default")
- `KUBECONFIG` - Path to kubeconfig file
- `KUBERNETES_CONTEXT` - Kubernetes context to use

### Authentication Flow
- GitHub OAuth for user authentication (sessions in MongoDB)
- GitHub Apps for repository access (installation IDs stored per user)
- API keys encrypted in database using `ENCRYPTION_KEY`

## Database Schema

### Task Execution Flow
```typescript
Task {
  userId: string,           // GitHub user ID
  environmentId: ObjectId,  // Links to Environment
  dockerId?: string,        // Container ID when running
  messages: Message[],      // Legacy message storage
  status: 'pending' | 'running' | 'completed' | 'failed'
}

TaskMessage {
  taskId: string,          // Links to Task
  role: 'user' | 'assistant',
  content: string,
  createdAt: Date
}
```

### Environment Configuration
```typescript
Environment {
  repository: string,                    // GitHub repo name
  repositoryFullName: string,           // owner/repo format
  runtime: 'node' | 'python' | 'php',  // Primary runtime
  environmentVariables: { key, value }[],
  configurationScript?: string          // Pre-execution setup
}
```

## Common Issues and Solutions

### "No space left on device" Errors (Docker Mode)
Docker containers accumulate and fill disk space. Run cleanup commands regularly.

### Pod "ImagePullBackOff" Errors (Kubernetes Mode)
- Ensure the container image is available in the cluster
- Check image pull secrets if using private registries
- Verify network connectivity from cluster to registry

### Claude Command Failed (Exit Code 128)
- Verify Claude Code is installed in container/pod
- Check OAuth token validity
- Ensure environment variables are properly set
- For Kubernetes: verify secrets and config maps are mounted correctly

### Message Not Found in TaskMessageModel
Ensure user messages are saved to `TaskMessageModel` when creating tasks in `server/api/tasks.post.ts`

## Required Environment Variables

```bash
# Database
DATABASE_URL=mongodb://localhost:27017/ccweb

# Container Mode
CONTAINER_MODE=docker                    # or "kubernetes"

# GitHub Integration
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY=path/to/private-key.pem
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret

# Encryption and Sessions
ENCRYPTION_KEY=your_32_character_secret_key
SESSION_SECRET=your_session_secret

# Kubernetes Configuration (when CONTAINER_MODE=kubernetes)
KUBERNETES_NAMESPACE=default            # Optional, defaults to "default"
KUBECONFIG=/path/to/kubeconfig          # Optional, uses default kubectl config
KUBERNETES_CONTEXT=my-context           # Optional, uses current context

# Docker Configuration (when CONTAINER_MODE=docker)
DOCKER_HOST=tcp://localhost:2376       # Optional, uses default socket
DOCKER_TLS_VERIFY=1                     # Optional, for TLS verification
DOCKER_CERT_PATH=/path/to/certs         # Optional, for TLS certificates
```

## Docker Configuration

The `ccweb-task-runner:latest` image includes:
- Ubuntu 24.04 base with development tools
- Node.js (18, 20, 22) via NVM
- Claude Code and Gemini CLI installed globally
- Git configuration and repository cloning capabilities

Build with: `docker build -t ccweb-task-runner:latest server/utils/docker/`