export type AIProviderType = 'anthropic-api' | 'claude-oauth' | 'gemini-cli' | 'admin-gemini' | 'codex-api' | 'codex-oauth'
export type AIModel = 'opus' | 'sonnet' | 'claude-sonnet-4' | 'gemini-2.0-flash'

export interface ExecuteOptions {
  prompt: string
  workdir: string
  model?: string
  planMode?: boolean
  mcpConfigPath?: string
  // Extra CLI config overrides (e.g., for Codex: model_reasoning_effort)
  configOverrides?: Record<string, any>
  onOutput?: (data: string) => void
}

export interface AICommandOptions {
  model?: string
  verbose?: boolean
  outputFormat?: 'stream-json' | 'text'
  permissionMode?: 'plan' | 'normal'
  configOverrides?: Record<string, any>
}

export interface ParsedOutput {
  toolCalls: any[]
  textMessages: string[]
  finalResult: string
  totalCostUsd?: number
}

export abstract class BaseAIProvider {
  constructor(protected providerType: AIProviderType) {}

  abstract getName(): string
  abstract getEnvironmentSetup(): string
  abstract buildCommand(options: AICommandOptions, prompt: string, mcpConfigPath?: string): string
  abstract parseOutput(rawOutput: string): ParsedOutput
  abstract supportsStreaming(): boolean
  abstract supportsPlanMode(): boolean

  getCliInstallCommand(): string {
    if (this.providerType === 'gemini-cli' || this.providerType === 'admin-gemini') {
      return 'which gemini || (echo "Gemini not found in PATH. Installing..." && npm install -g @google/gemini-cli)'
    }
    if (this.providerType === 'codex-api' || this.providerType === 'codex-oauth') {
      return 'which codex || (echo "Codex not found in PATH. Installing..." && npm install -g @openai/codex)'
    }
    return 'which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)'
  }
}
