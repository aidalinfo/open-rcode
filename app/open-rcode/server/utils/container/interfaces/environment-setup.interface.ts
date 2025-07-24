export interface EnvironmentConfig {
  baseEnv: Record<string, string>;
  aiTokens: {
    anthropic?: string;
    claude?: string;
    gemini?: string;
  };
  githubTokens: {
    appToken?: string;
    installationToken?: string;
  };
  userVariables: Array<{
    key: string;
    value: string;
    description?: string;
  }>;
  runtimeVersions?: {
    python?: string;
    node?: string;
    rust?: string;
    go?: string;
    swift?: string;
  };
}

export interface WorkspaceSetup {
  workspaceDir: string;
  repoPath: string;
  configPath?: string;
}

export interface EnvironmentBuilder {
  buildEnvironment(config: EnvironmentConfig): Record<string, string>;
  detectAIProvider(config: EnvironmentConfig): 'claude' | 'anthropic' | 'gemini' | null;
  prepareWorkspace(containerId: string, repoUrl?: string, branch?: string): Promise<WorkspaceSetup>;
}