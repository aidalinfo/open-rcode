import type { AICommandOptions, ParsedOutput } from './base-ai-provider'
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

  buildCommand(options: AICommandOptions, prompt: string): string {
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
    return parts.join(' ')
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
}
