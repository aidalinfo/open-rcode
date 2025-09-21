import type { AICommandOptions, McpServerConfig, ParsedOutput } from './base-ai-provider'
import { BaseAIProvider } from './base-ai-provider'

export class CodexProvider extends BaseAIProvider {
  getName(): string {
    return 'Codex'
  }

  getEnvironmentSetup(): string {
    if (this['providerType'] === 'codex-api') {
      return 'export OPENAI_API_KEY="$OPENAI_API_KEY"'
    }
    // OAuth: write ~/.codex/auth.json from CODEX_OAUTH_JSON
    return [
      'mkdir -p ~/.codex',
      'if [ -n "$CODEX_OAUTH_JSON" ]; then',
      '  printf "%s" "$CODEX_OAUTH_JSON" > ~/.codex/auth.json',
      '  chmod 600 ~/.codex/auth.json',
      'fi'
    ].join('\n')
  }

  buildCommand(options: AICommandOptions, prompt: string, _mcpConfigPath?: string): string {
    const preCommand: string[] = []

    if (options.selectedMcpServers && options.selectedMcpServers.length > 0) {
      const setupScript = this.codexSetupMcp(options.selectedMcpServers)
      if (setupScript.trim()) {
        preCommand.push(setupScript)
      }
    }

    // Build Codex CLI command with optional -c config overrides
    const escaped = `$(cat <<'PROMPT_EOF'\n${prompt}\nPROMPT_EOF\n)`

    const parts: string[] = [
      'codex',
      'exec'
    ]

    // Append generic config overrides as -c key=value
    if (options.configOverrides && typeof options.configOverrides === 'object') {
      for (const [key, rawVal] of Object.entries(options.configOverrides)) {
        let v = rawVal as any
        let rendered: string
        if (typeof v === 'string') {
          const trimmed = v.trim()
          const looksLikeTomlLiteral = /^(true|false|[0-9]+(\.[0-9]+)?|\{.*\}|\[.*\])$/i.test(trimmed)
          rendered = looksLikeTomlLiteral ? trimmed : `\"${trimmed.replace(/\"/g, '\\\"')}\"`
        } else if (typeof v === 'number' || typeof v === 'boolean') {
          rendered = String(v)
        } else {
          const asJson = JSON.stringify(v)
          rendered = `\"${asJson.replace(/\"/g, '\\\"')}\"`
        }
        parts.push('-c', `${key}=${rendered}`)
      }
    }

    parts.push('--full-auto', `"${escaped}"`)

    const codexCommand = parts.join(' ')
    if (preCommand.length === 0) {
      return codexCommand
    }

    preCommand.push(codexCommand)
    return preCommand.join('\n')
  }

  parseOutput(rawOutput: string): ParsedOutput {
    // Treat as plain text
    return {
      toolCalls: [],
      textMessages: rawOutput ? [rawOutput] : [],
      finalResult: rawOutput || 'Tâche terminée'
    }
  }

  supportsStreaming(): boolean {
    return false
  }

  supportsPlanMode(): boolean {
    return false
  }

  codexSetupMcp(servers: McpServerConfig[]): string {
    if (!Array.isArray(servers) || servers.length === 0) {
      return ''
    }

    const entries = servers
      .map(server => this.renderMcpServer(server))
      .filter(Boolean)
      .join('\n\n')

    if (!entries.trim()) {
      return ''
    }

    return [
      'mkdir -p ~/.codex',
      "cat <<'CODEX_MCP_CONFIG' > ~/.codex/config.toml",
      entries,
      'CODEX_MCP_CONFIG',
      'chmod 600 ~/.codex/config.toml'
    ].join('\n')
  }

  private renderMcpServer(server: McpServerConfig): string {
    const keyFromName = this.slugify(server.name || '')
    const key = keyFromName || this.slugify(server.id) || server.id
    if (!key) return ''

    const command = server.command || (server.type === 'sse' ? 'npx' : undefined)
    const args = this.resolveArgs(server)

    if (!command) {
      return ''
    }

    const lines: string[] = [`[mcp_servers."${key}"]`, `command = ${this.quoteToml(command)}`]

    if (args.length > 0) {
      lines.push(`args = ${this.formatTomlArray(args)}`)
    } else {
      lines.push('args = []')
    }

    const envTable = this.formatTomlInlineTable(server.env)
    lines.push(`env = ${envTable}`)

    if (typeof server.startupTimeoutMs === 'number' && Number.isFinite(server.startupTimeoutMs)) {
      lines.push(`startup_timeout_ms = ${Math.floor(server.startupTimeoutMs)}`)
    }

    return lines.join('\n')
  }

  private resolveArgs(server: McpServerConfig): string[] {
    if (Array.isArray(server.args) && server.args.length > 0) {
      return server.args.map(arg => String(arg))
    }

    if (server.type === 'sse' && server.url) {
      return ['-y', 'mcp-remote', server.url]
    }

    return []
  }

  private slugify(input: string): string {
    if (!input) return ''
    const trimmed = input.trim().toLowerCase()
    const slug = trimmed
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return slug || trimmed || ''
  }

  private quoteToml(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`
  }

  private formatTomlArray(values: string[]): string {
    const rendered = values.map(v => this.quoteToml(v))
    return `[${rendered.join(', ')}]`
  }

  private formatTomlInlineTable(env?: Record<string, string>): string {
    if (!env || Object.keys(env).length === 0) {
      return '{ }'
    }

    const parts = Object.keys(env)
      .filter(key => key)
      .map(key => `${key} = ${this.quoteToml(String(env[key]))}`)

    return `{ ${parts.join(', ')} }`
  }
}
