export class ContainerScripts {
  static createWorkspace(workdir: string = '/tmp/workspace'): string {
    return `
      # Create and change to working directory
      mkdir -p "${workdir}"
      cd "${workdir}"
    `.trim()
  }

  static configureGit(workdir?: string): string {
    return `
      # Configuration Git
      git config --global user.email "open-rcode@example.com" || true
      git config --global user.name "open-rcode Container" || true
      git config --global init.defaultBranch main || true
      ${workdir ? `git config --global --add safe.directory "${workdir}" || true` : ''}
    `.trim()
  }

  static loadNodeEnvironment(): string {
    return `
      # Charger l'environnement Node et npm global (version bash)
      [ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh || true
      [ -f /etc/profile ] && source /etc/profile || true
    `.trim()
  }

  static installCLI(cliName: 'claude' | 'gemini'): string {
    const packages = {
      claude: '@anthropic-ai/claude-code',
      gemini: '@google/gemini-cli'
    }

    return `
      # Check if ${cliName} is installed
      if ! which ${cliName} >/dev/null 2>&1; then
        echo "${cliName} not found in PATH. Installing..." >&2
        npm install -g ${packages[cliName]} >/dev/null 2>&1
        echo "${cliName} installation completed" >&2
      fi
    `.trim()
  }

  static setupEnvironment(envSetup: string): string {
    return envSetup
  }

  static cleanClaudeSettings(): string {
    return `
      # Clean Claude settings to avoid conflicts
      rm -f ~/.claude/settings.json || true
    `.trim()
  }

  static wrapConfigurationScript(script: string): string {
    return `
      echo "=== Executing configuration script ==="
      ${script}
      echo "=== Configuration script completed ==="
    `.trim()
  }

  static buildFullScript(parts: string[]): string {
    return parts.filter(part => part.trim()).join('\n\n')
  }

  static checkMcpConfig(workdir: string): string {
    return `
      # Check for .mcp.json file
      MCP_CONFIG_PATH=""
      if [ -f "${workdir}/.mcp.json" ]; then
        MCP_CONFIG_PATH="${workdir}/.mcp.json"
        echo "MCP config found at: $MCP_CONFIG_PATH" >&2
      elif [ -f "${workdir}/servers.json" ]; then
        MCP_CONFIG_PATH="${workdir}/servers.json"
        echo "MCP config found at: $MCP_CONFIG_PATH" >&2
      fi
    `.trim()
  }

  static buildExecutionScript(
    workdir: string,
    envSetup: string,
    cliName: 'claude' | 'gemini',
    aiCommand: string,
    checkForMcpConfig: boolean = false
  ): string {
    const parts = [
      this.createWorkspace(workdir),
      this.configureGit(workdir),
      this.loadNodeEnvironment(),
      this.installCLI(cliName),
      this.setupEnvironment(envSetup)
    ]

    // Add Claude settings cleanup only for Claude CLI
    if (cliName === 'claude') {
      parts.push(this.cleanClaudeSettings())
    }

    // Check for MCP config if requested
    if (checkForMcpConfig && cliName === 'claude') {
      parts.push(this.checkMcpConfig(workdir))
    }

    parts.push(aiCommand)

    return this.buildFullScript(parts)
  }

  static buildConfigurationScript(workdir: string, configScript: string): string {
    return this.buildFullScript([
      this.createWorkspace(workdir),
      this.configureGit(workdir),
      this.loadNodeEnvironment(),
      this.wrapConfigurationScript(configScript)
    ])
  }
}
