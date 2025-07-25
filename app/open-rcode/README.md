# CCWeb - AI-Assisted Development Platform

CCWeb is a container-based web platform that enables developers to execute AI-assisted programming tasks in isolated containers (Docker or Kubernetes), automatically creating GitHub Pull Requests. Built with Nuxt 4, MongoDB, and supports both Docker and Kubernetes orchestration.

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

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL=mongodb://localhost:27017/ccweb

# Container Mode Configuration
CONTAINER_MODE=docker                    # or "kubernetes"

# GitHub Integration (Required)
GITHUB_APP_ID=your_github_app_id
GITHUB_PRIVATE_KEY=value_key
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret

# Security & Sessions (Required)
ENCRYPTION_KEY=your_32_character_secret_key_here
SESSION_SECRET=your_session_secret_here


# Nuxt UI Pro License (Required for build)
NUXT_UI_PRO_LICENSE=your_license_key

# Docker Configuration (Optional - when CONTAINER_MODE=docker)
DOCKER_HOST=tcp://localhost:2376       # Optional, uses default socket
DOCKER_TLS_VERIFY=1                     # Optional, for TLS verification
DOCKER_CERT_PATH=/path/to/certs         # Optional, for TLS certificates

# Kubernetes Configuration (Required when CONTAINER_MODE=kubernetes)
KUBERNETES_NAMESPACE=default            # Optional, defaults to "default"
KUBECONFIG=/path/to/kubeconfig          # Optional, uses default kubectl config
KUBERNETES_CONTEXT=my-context           # Optional, uses current context
```

## Setup & Installation

### 1. Prerequisites

**For Docker Mode (Default):**
- Docker Engine installed and running
- MongoDB (can use docker-compose for local development)

**For Kubernetes Mode:**
- Kubernetes cluster access
- kubectl configured
- MongoDB (can be in-cluster or external)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Database Setup

Start MongoDB using Docker Compose (for local development):

```bash
# From project root
docker-compose up -d mongodb
```

### 4. Build Task Runner Image

For Docker mode, build the task runner container image:

```bash
docker build -t ccweb-task-runner:latest server/utils/docker/
```

## Development

### Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

### Code Quality

Run linting and type checking:

```bash
pnpm lint      # ESLint checking
pnpm typecheck # TypeScript validation
```

## Deployment

### Docker Deployment

#### Option 1: Direct Docker Build

```bash
# Build the application image
docker build -t ccweb:latest \
  --build-arg NUXT_UI_PRO_LICENSE=your_license_key .

# Run the container
docker run -d \
  --name ccweb-app \
  -p 3000:3000 \
  --env-file .env \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ccweb:latest
```

#### Option 2: Docker Compose

Create a `docker-compose.prod.yml`:

```yaml
services:
  app:
    build:
      context: .
      args:
        NUXT_UI_PRO_LICENSE: ${NUXT_UI_PRO_LICENSE}
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mongodb://mongodb:27017/ccweb
      - CONTAINER_MODE=docker
      - GITHUB_APP_ID=${GITHUB_APP_ID}
      - GITHUB_PRIVATE_KEY=${GITHUB_PRIVATE_KEY}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - mongodb

  mongodb:
    image: mongo:7-jammy
    restart: always
    volumes:
      - db-data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: ccweb

volumes:
  db-data:
```

Deploy with:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

#### 1. Create Secrets

```bash
# GitHub App private key
kubectl create secret generic github-private-key \
  --from-file=private-key.pem=path/to/your/private-key.pem

# Application secrets
kubectl create secret generic ccweb-secrets \
  --from-literal=github-app-id="your_app_id" \
  --from-literal=github-client-id="your_client_id" \
  --from-literal=github-client-secret="your_client_secret" \
  --from-literal=encryption-key="your_32_character_secret_key" \
  --from-literal=session-secret="your_session_secret" \
  --from-literal=claude-oauth-token="your_claude_token" \
  --from-literal=database-url="mongodb://mongodb:27017/ccweb"
```

#### 2. Deploy Application

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ccweb-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ccweb-app
  template:
    metadata:
      labels:
        app: ccweb-app
    spec:
      containers:
      - name: ccweb
        image: ccweb:latest
        ports:
        - containerPort: 3000
        env:
        - name: CONTAINER_MODE
          value: "kubernetes"
        - name: KUBERNETES_NAMESPACE
          value: "default"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: database-url
        - name: GITHUB_APP_ID
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: github-app-id
        - name: GITHUB_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: github-client-id
        - name: GITHUB_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: github-client-secret
        - name: GITHUB_PRIVATE_KEY
          value: "/etc/github/private-key.pem"
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: encryption-key
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: session-secret
        - name: CLAUDE_CODE_OAUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: ccweb-secrets
              key: claude-oauth-token
        volumeMounts:
        - name: github-private-key
          mountPath: /etc/github
          readOnly: true
      volumes:
      - name: github-private-key
        secret:
          secretName: github-private-key
      serviceAccountName: ccweb-service-account

---
apiVersion: v1
kind: Service
metadata:
  name: ccweb-service
spec:
  selector:
    app: ccweb-app
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ccweb-service-account

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ccweb-pod-manager
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["create", "delete", "get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ccweb-pod-manager-binding
subjects:
- kind: ServiceAccount
  name: ccweb-service-account
  namespace: default
roleRef:
  kind: ClusterRole
  name: ccweb-pod-manager
  apiGroup: rbac.authorization.k8s.io
```

Deploy with:

```bash
kubectl apply -f k8s-deployment.yaml
```

## Production Build

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

## Container Management

### Docker Mode

Monitor and clean up containers:

```bash
# List active task containers
docker ps -f name=ccweb-task

# View container logs
docker logs <container_id>

# Cleanup old containers
docker stop $(docker ps -q -f name=ccweb-task) && \
docker rm $(docker ps -aq -f name=ccweb-task)
```

### Kubernetes Mode

Monitor and clean up pods:

```bash
# List active task pods
kubectl get pods -l ccweb.managed=true

# View pod logs
kubectl logs <pod_name>

# Cleanup old pods
kubectl delete pods -l ccweb.managed=true
```

## Monitoring & Troubleshooting

### Health Checks

- Application health: `GET /api/health`
- Container status: `GET /api/monitoring/containers`

### Common Issues

1. **"No space left on device" (Docker Mode)**
   - Run container cleanup commands regularly
   - Monitor disk usage: `docker system df`

2. **Pod "ImagePullBackOff" (Kubernetes Mode)**
   - Ensure container images are available in cluster
   - Check image pull secrets and registry connectivity

3. **Claude Command Failed (Exit Code 128)**
   - Verify Claude Code installation in container/pod
   - Check OAuth token validity and environment variables

### Security Considerations

- Never commit `.env` files or secrets to version control
- Use proper RBAC for Kubernetes deployments
- Regularly rotate API keys and secrets
- Monitor container/pod resource usage and cleanup
