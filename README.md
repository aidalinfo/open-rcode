# Open RCode

A development environment platform that provides containerized workspaces for code execution and collaboration.

## Overview

Open RCode is a Nuxt.js application that enables users to create and manage development environments in isolated containers. It integrates with GitHub for repository management and supports multiple AI providers for code assistance.

## Features

- **Containerized Environments**: Create isolated development environments using Docker/Kubernetes
- **GitHub Integration**: Clone repositories and manage branches
- **AI Integration**: Support for Claude (Anthropic) and Gemini API
- **Task Management**: Execute and monitor development tasks
- **User Authentication**: GitHub OAuth integration
- **Environment Management**: Create, update, and delete development environments

## Getting Started

### Prerequisites

- Node.js (version specified in package.json)
- Docker or Kubernetes cluster
- MongoDB database
- GitHub App credentials
- AI provider API keys (Anthropic Claude or Google Gemini)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   cd app/open-rcode
   pnpm install
   ```

3. Configure environment variables
4. Start the development server:
   ```bash
   pnpm dev
   ```

### Building for Production

```bash
pnpm build
```

## Architecture

- **Frontend**: Nuxt.js with Vue.js components
- **Backend**: Nuxt server API routes
- **Database**: MongoDB with Mongoose ODM
- **Containers**: Docker/Kubernetes for isolated environments
- **Authentication**: GitHub OAuth

## Development

- **Linting**: `pnpm lint`
- **Type Checking**: `pnpm typecheck`
- **Development Server**: `pnpm dev`

## Docker Support

The project includes Docker configuration files:
- `docker-compose.yml` - Production setup
- `docker-compose-dev.yml` - Development setup
- `Dockerfile` - Application container

## License

See license information in the project repository.