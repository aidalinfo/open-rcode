export type AIProviderType = 'anthropic-api' | 'claude-oauth' | 'gemini-cli' | 'admin-gemini'
export type AIModel = 'opus' | 'sonnet' | 'claude-sonnet-4' | 'gemini-2.0-flash'

export interface ExecuteOptions {
  prompt: string
  workdir: string
  model?: string
  planMode?: boolean
  onOutput?: (data: string) => void
}

export interface AICommandOptions {
  model?: string
  verbose?: boolean
  outputFormat?: 'stream-json' | 'text'
  permissionMode?: 'plan' | 'normal'
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
  abstract buildCommand(options: AICommandOptions, prompt: string): string
  abstract parseOutput(rawOutput: string): ParsedOutput
  abstract supportsStreaming(): boolean
  abstract supportsPlanMode(): boolean
  
  getCliInstallCommand(): string {
    if (this.providerType === 'gemini-cli' || this.providerType === 'admin-gemini') {
      return 'which gemini || (echo "Gemini not found in PATH. Installing..." && npm install -g @google/gemini-cli)'
    }
    return 'which claude || (echo "Claude not found in PATH. Installing..." && npm install -g @anthropic-ai/claude-code)'
  }
}