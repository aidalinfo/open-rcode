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
    // codex exec --full-auto "<prompt>"
    const escaped = `$(cat <<'PROMPT_EOF'\n${prompt}\nPROMPT_EOF\n)`
    return `codex exec --full-auto "${escaped}"`
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

