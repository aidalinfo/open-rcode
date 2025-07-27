# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCWeb is a container-based web platform that enables developers to execute AI-assisted programming tasks in isolated containers (Docker or Kubernetes), automatically creating GitHub Pull Requests. Built with Nuxt 4, MongoDB, and supports both Docker and Kubernetes orchestration.

## Tech Stack

**Frontend:**
- Nuxt 4 with Vue 3 and TypeScript
- Nuxt UI Pro (component library)
- TailwindCSS 4.x for styling
- SSR/SPA hybrid rendering

**Backend:**
- Nuxt Server API (Nitro)
- MongoDB with Mongoose ODM
- Docker/Kubernetes for container orchestration
- GitHub Apps API integration

**Key Dependencies:**
- `@octokit/auth-app` - GitHub App authentication
- `dockerode` - Docker API client
- `jsonwebtoken` - JWT token handling
- `mongoose` - MongoDB object modeling
- `cron` - Task scheduling

## Development Commands

```bash
# Core development
pnpm dev              # Start development server (http://localhost:3000)
pnpm build           # Production build
pnpm preview         # Preview production build

# Code quality (ALWAYS run before committing)
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

## API Structure

### Core Endpoints
- `GET /api/tasks` - List user tasks with pagination
- `POST /api/tasks` - Create new task (saves to both Task.messages and TaskMessageModel)
- `GET /api/tasks/[id]` - Get task details
- `POST /api/tasks/[id]/execute` - Execute task in container
- `GET /api/tasks/[id]/messages` - Get task conversation history

### Environment Management
- `GET /api/environments` - List user environments
- `POST /api/environments` - Create new environment
- `PUT /api/environments/[id]` - Update environment
- `DELETE /api/environments/[id]` - Delete environment

### Authentication & GitHub
- `GET /api/auth/github` - GitHub OAuth flow
- `GET /api/auth/github-app` - GitHub App installation
- `GET /api/auth/verify` - Verify session

### User Settings
- `GET/PUT /api/user/anthropic-key` - Anthropic API key management
- `GET/PUT /api/user/claude-oauth-token` - Claude OAuth token management
- `GET/PUT /api/user/gemini-api-key` - Gemini API key management

### Monitoring
- `GET /api/monitoring/containers` - Container status
- `POST /api/monitoring/cleanup` - Container cleanup

## Database Schema

### Core Models (server/models/)

**Task Model:**
```typescript
Task {
  _id: ObjectId,
  userId: string,                       // GitHub user ID
  environmentId: ObjectId,              // Links to Environment
  dockerId?: string,                    // Container/Pod ID when running
  podName?: string,                     // Kubernetes pod name
  messages: Message[],                  // Legacy message storage (keep for compatibility)
  status: 'pending' | 'running' | 'completed' | 'failed',
  createdAt: Date,
  updatedAt: Date,
  pullRequestUrl?: string,              // Generated PR URL
  errorMessage?: string                 // Error details if failed
}
```

**TaskMessage Model:**
```typescript
TaskMessage {
  _id: ObjectId,
  taskId: string,                       // Links to Task._id
  role: 'user' | 'assistant',
  content: string,
  createdAt: Date
}
```

**Environment Model:**
```typescript
Environment {
  _id: ObjectId,
  userId: string,                       // Owner GitHub user ID
  name: string,                         // Display name
  repository: string,                   // Repository name
  repositoryFullName: string,           // owner/repo format
  runtime: 'node' | 'python' | 'php',  // Primary runtime
  environmentVariables: { key: string, value: string }[],
  configurationScript?: string,         // Pre-execution setup commands
  createdAt: Date,
  updatedAt: Date
}
```

**User Model:**
```typescript
User {
  _id: ObjectId,
  githubId: string,                     // GitHub user ID
  username: string,                     // GitHub username
  email?: string,
  encryptedAnthropicKey?: string,       // Encrypted API key
  encryptedClaudeOAuthToken?: string,   // Encrypted OAuth token
  encryptedGeminiApiKey?: string,       // Encrypted API key
  githubAppInstallations: string[],     // GitHub App installation IDs
  createdAt: Date,
  updatedAt: Date
}
```

## Development Patterns

### Adding New API Endpoints
1. Create endpoint file in `server/api/` following Nuxt convention
2. Use `defineEventHandler()` for request handling
3. Import utilities from `server/utils/` (auth, database, etc.)
4. Follow error handling patterns from existing endpoints
5. Add proper TypeScript types

### Working with Containers
- Use `ContainerManagerFactory` to get appropriate manager (Docker/Kubernetes)
- Always handle container cleanup in error scenarios
- Log container operations for debugging
- Set proper resource limits and timeouts

### Database Operations
- Use Mongoose models from `server/models/`
- Always validate user ownership for data access
- Use transactions for multi-model operations
- Encrypt sensitive data using `crypto.ts` utilities

### Frontend Components
- Follow Nuxt UI Pro component patterns
- Use TypeScript for all component props
- Implement proper loading and error states
- Use composables for shared logic

## Testing & Validation

### Before Committing Changes
```bash
# Always run these commands before committing
pnpm lint          # Check code style and potential issues
pnpm typecheck     # Ensure TypeScript compilation
pnpm build         # Verify production build works
```

### Manual Testing Checklist
- [ ] Task creation and execution flow
- [ ] Container cleanup after task completion
- [ ] GitHub OAuth and App installation
- [ ] Environment CRUD operations
- [ ] Error handling and user feedback

## Common Issues and Solutions

### "No space left on device" Errors (Docker Mode)
Docker containers accumulate and fill disk space. Run cleanup commands regularly:
```bash
# Check disk usage
docker system df

# Clean up old containers
docker stop $(docker ps -q -f name=ccweb-task) && docker rm $(docker ps -aq -f name=ccweb-task)

# Remove unused images
docker image prune -f
```

### Pod "ImagePullBackOff" Errors (Kubernetes Mode)
- Ensure the container image is available in the cluster
- Check image pull secrets if using private registries
- Verify network connectivity from cluster to registry
- Check pod events: `kubectl describe pod <pod_name>`

### Claude Command Failed (Exit Code 128)
- Verify Claude Code is installed in container/pod
- Check OAuth token validity in user settings
- Ensure environment variables are properly set
- For Kubernetes: verify secrets and config maps are mounted correctly
- Check container/pod logs for detailed error messages

### Message Not Found in TaskMessageModel
Ensure user messages are saved to `TaskMessageModel` when creating tasks in `server/api/tasks.post.ts`

### Build Failures
- Verify `NUXT_UI_PRO_LICENSE` environment variable is set
- Check for TypeScript errors with `pnpm typecheck`
- Ensure all dependencies are installed with `pnpm install`

### Authentication Issues
- Verify GitHub App configuration and permissions
- Check OAuth callback URLs match your domain
- Ensure session secrets are properly configured
- Verify MongoDB connection for session storage

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

## Key Files Reference

### Core Orchestration
- `server/utils/task-container.ts` - Main task execution workflow orchestrator
- `server/utils/claude-executor.ts` - Claude Code command execution in containers
- `server/utils/container-setup.ts` - Container environment configuration
- `server/utils/pull-request-creator.ts` - Git operations and PR creation

### Container Management
- `server/utils/container/container-manager-factory.ts` - Factory for Docker/Kubernetes managers
- `server/utils/container/docker-adapter.ts` - Docker operations adapter
- `server/utils/container/kubernetes-adapter.ts` - Kubernetes operations adapter
- `server/utils/container/kubernetes/kubernetes-manager.ts` - Native kubectl operations

### Authentication & GitHub
- `server/utils/auth.ts` - Session and user authentication utilities
- `server/utils/github-app.ts` - GitHub App integration
- `server/api/auth/github.get.ts` - GitHub OAuth flow
- `server/api/auth/github-app.get.ts` - GitHub App installation

### Data & Encryption
- `server/utils/database.ts` - MongoDB connection and configuration
- `server/utils/crypto.ts` - API key encryption/decryption utilities
- `server/models/` - Mongoose models for all data entities

### Frontend Components
- `app/components/TaskTable.vue` - Task list and status display
- `app/components/ChatPrompt.vue` - Task creation interface
- `app/pages/app/task/[id].vue` - Task detail and execution view
- `app/pages/app/settings/` - Environment and user settings

## Performance Considerations

### Container Resource Management
- Monitor container memory usage with `docker stats` or `kubectl top pods`
- Set resource limits in container configurations
- Implement automatic cleanup of completed containers/pods
- Use container monitoring plugin: `server/plugins/container-monitor.ts`

### Database Optimization
- Index frequently queried fields (userId, taskId, environmentId)
- Use pagination for large datasets (implemented in tasks API)
- Consider archiving old completed tasks
- Monitor MongoDB performance and connection pool usage

### GitHub API Rate Limits
- Implement proper rate limiting for GitHub API calls
- Use GitHub App authentication for higher rate limits
- Cache repository and branch information when possible
- Handle rate limit responses gracefully with retries