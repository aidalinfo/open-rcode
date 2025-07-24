import type { 
  TaskOrchestrator, 
  TaskContainerOptions, 
  ContainerSetupResult,
  ContainerInfo
} from '../interfaces/task-orchestrator.interface';
import { KubernetesManager } from './kubernetes-manager';
import { TaskModel } from '../../../models/Task';
import { EnvironmentModel } from '../../../models/Environment';
import { UserModel } from '../../../models/User';
import { connectToDatabase } from '../../database';
import { generateInstallationToken, getInstallationRepositories } from '../../github-app';
import { decrypt } from '../../crypto';

export class KubernetesTaskManager implements TaskOrchestrator {
  private k8sManager: KubernetesManager;
  private workspaceBase = '/workspace';

  constructor(kubeconfig?: string, namespace = 'default') {
    this.k8sManager = new KubernetesManager(kubeconfig, namespace);
  }

  async createTaskContainer(options: TaskContainerOptions): Promise<ContainerSetupResult> {
    await connectToDatabase();

    // Load task, environment and user data
    const task = await TaskModel.findById(options.taskId);
    if (!task) {
      throw new Error(`Task ${options.taskId} not found`);
    }

    const environment = await EnvironmentModel.findById(options.environmentId);
    const user = await UserModel.findById(options.userId);

    // Build environment variables
    const env = await this.buildEnvironmentVariables(task, environment, user, options);

    // Detect AI provider
    const provider = this.detectAIProvider(env);

    // Create pod
    const podName = `ccweb-task-${task._id}`;
    const containerId = await this.k8sManager.createContainer({
      name: podName,
      image: process.env.TASK_RUNNER_IMAGE || 'ghcr.io/killian-aidalinfo/ccweb-task-runner:latest',
      env,
      workingDir: this.workspaceBase,
      labels: {
        'task-id': task._id.toString(),
        'user-id': options.userId,
        'environment-id': options.environmentId
      },
      memory: options.memory || '2Gi',
      cpus: options.cpus || 2
    });

    // Start the pod
    await this.k8sManager.startContainer(containerId);

    // Setup workspace in the pod
    const workspaceDir = `${this.workspaceBase}/${environment?.repository || 'ccweb'}`;
    await this.setupWorkspace(containerId, workspaceDir, task, environment, user);

    // Install Claude Code or other AI tools
    const aiCommands = await this.installAITools(containerId, provider, env);

    return {
      containerId,
      containerName: podName,
      workspaceDir: `${workspaceDir}/repo`,
      claudeCommand: aiCommands.claude,
      geminiCommand: aiCommands.gemini,
      provider: 'kubernetes'
    };
  }

  async executeCommand(containerId: string, command: string, workingDir?: string): Promise<string> {
    const result = await this.k8sManager.executeInContainer({
      containerId,
      command: ['/bin/bash', '-c', command],
      workingDir: workingDir || this.workspaceBase
    });

    if (result.exitCode !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
    }

    return result.stdout;
  }

  async executeAIPrompt(containerId: string, prompt: string, provider?: string): Promise<string> {
    const command = provider === 'gemini' ? 'gemini' : 'claude';
    const escapedPrompt = prompt.replace(/'/g, "'\"'\"'");
    
    const result = await this.k8sManager.executeInContainer({
      containerId,
      command: ['/bin/bash', '-c', `${command} '${escapedPrompt}'`],
      workingDir: `${this.workspaceBase}/ccweb/repo`
    });

    if (result.exitCode !== 0) {
      throw new Error(`AI command failed: ${result.stderr}`);
    }

    return result.stdout;
  }

  async cleanupTaskContainer(taskId: string): Promise<void> {
    const pods = await this.k8sManager.listContainers({
      label: [`task-id=${taskId}`]
    });

    for (const pod of pods) {
      await this.k8sManager.removeContainer(pod.id);
    }
  }

  async getTaskContainerStatus(taskId: string): Promise<ContainerInfo | null> {
    const pods = await this.k8sManager.listContainers({
      label: [`task-id=${taskId}`]
    });

    return pods.length > 0 ? pods[0] : null;
  }

  private async buildEnvironmentVariables(
    task: any, 
    environment: any, 
    user: any, 
    options: TaskContainerOptions
  ): Promise<Record<string, string>> {
    const env: Record<string, string> = {
      // Base environment
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      DEBIAN_FRONTEND: 'noninteractive',
      TZ: 'UTC',
      
      // Runtime versions
      CODEX_ENV_PYTHON_VERSION: '3.12',
      CODEX_ENV_NODE_VERSION: '20',
      CODEX_ENV_RUST_VERSION: '1.87.0',
      CODEX_ENV_GO_VERSION: '1.23.8',
      CODEX_ENV_SWIFT_VERSION: '6.1',
      
      // Task metadata
      TASK_ID: task._id.toString(),
      USER_ID: options.userId,
      ENVIRONMENT_ID: options.environmentId,
    };

    // Add AI tokens
    if (user?.anthropicApiKey) {
      env.ANTHROPIC_API_KEY = user.anthropicApiKey;
    }
    if (user?.claudeCodeOauthToken) {
      env.CLAUDE_CODE_OAUTH_TOKEN = user.claudeCodeOauthToken;
    }
    if (user?.geminiApiKey) {
      env.GEMINI_API_KEY = user.geminiApiKey;
    }

    // Add environment variables
    if (environment?.environmentVariables) {
      for (const envVar of environment.environmentVariables) {
        env[envVar.key] = envVar.value;
      }
    }

    // Add custom environment variables
    if (options.customEnv) {
      Object.assign(env, options.customEnv);
    }

    return env;
  }

  private detectAIProvider(env: Record<string, string>): 'claude' | 'anthropic' | 'gemini' | null {
    if (env.CLAUDE_CODE_OAUTH_TOKEN) return 'claude';
    if (env.ANTHROPIC_API_KEY) return 'anthropic';
    if (env.GEMINI_API_KEY) return 'gemini';
    return null;
  }

  private async setupWorkspace(
    containerId: string, 
    workspaceDir: string, 
    task: any,
    environment: any,
    user: any
  ): Promise<void> {
    // Create workspace directory
    await this.executeCommand(containerId, `mkdir -p ${workspaceDir}`);

    // Clone repository if configured
    if (environment?.repositoryFullName) {
      const installationToken = await this.getInstallationToken(user, environment.repositoryFullName);
      
      if (!installationToken) {
        throw new Error(`No GitHub App token available for repository ${environment.repositoryFullName}. Please install the GitHub App on this repository.`);
      }

      const repositoryUrl = `https://x-access-token:${installationToken}@github.com/${environment.repositoryFullName}.git`;
      const defaultBranch = environment.defaultBranch || 'main';

      console.log(`Cloning repository ${environment.repositoryFullName} (branch: ${defaultBranch}) in Kubernetes pod`);
      
      const cloneScript = `
        cd "${workspaceDir}"
        export GIT_TERMINAL_PROMPT=0
        git clone -b "${defaultBranch}" "${repositoryUrl}" repo
      `;

      const result = await this.k8sManager.executeInContainer({
        containerId,
        command: ['/bin/bash', '-c', cloneScript],
        user: 'root'
      });

      if (result.exitCode !== 0) {
        throw new Error(`Git clone failed with exit code ${result.exitCode}: ${result.stderr}`);
      }

      console.log(`Repository cloned successfully in pod at ${workspaceDir}/repo`);

      // Configure git
      await this.configureGitInContainer(user, containerId, `${workspaceDir}/repo`);
    }
  }

  private async getInstallationToken(user: any, repositoryFullName: string): Promise<string | null> {
    if (!user.githubAppInstallationIds?.length) return null;

    for (const installationId of user.githubAppInstallationIds) {
      try {
        const installationRepos = await getInstallationRepositories(installationId);
        const hasRepository = installationRepos.repositories.some(
          (repo: any) => repo.full_name === repositoryFullName
        );

        if (hasRepository) {
          return await generateInstallationToken(installationId);
        }
      } catch (error) {
        console.warn(`Error checking installation ${installationId}:`, error);
        continue;
      }
    }

    return null;
  }

  private async configureGitInContainer(user: any, containerId: string, repoDir: string): Promise<void> {
    const configScript = `
      cd "${repoDir}"
      git config user.name "${user.name || user.username}"
      git config user.email "${user.email || `${user.username}@users.noreply.github.com`}"
      git config --global --add safe.directory "${repoDir}"
    `;

    await this.k8sManager.executeInContainer({
      containerId,
      command: ['/bin/bash', '-c', configScript],
      user: 'root'
    });
  }

  private async installAITools(
    containerId: string, 
    provider: string | null,
    env: Record<string, string>
  ): Promise<{ claude?: string; gemini?: string }> {
    const commands: { claude?: string; gemini?: string } = {};

    // Install Claude Code if token is available
    if (env.CLAUDE_CODE_OAUTH_TOKEN) {
      try {
        await this.executeCommand(containerId, 'npm install -g @anthropic/claude-code');
        commands.claude = 'claude';
      } catch (error) {
        console.error('Failed to install Claude Code:', error);
      }
    }

    // Setup Gemini if API key is available
    if (env.GEMINI_API_KEY) {
      // Create gemini wrapper script
      const geminiScript = `#!/bin/bash
echo "Using Gemini API..."
# Add actual Gemini integration here
`;
      await this.executeCommand(containerId, `echo '${geminiScript}' > /usr/local/bin/gemini && chmod +x /usr/local/bin/gemini`);
      commands.gemini = 'gemini';
    }

    return commands;
  }
}