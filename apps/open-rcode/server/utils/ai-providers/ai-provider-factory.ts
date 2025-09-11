import type { BaseAIProvider, AIProviderType } from './base-ai-provider'
import { ClaudeProvider } from './claude-provider'
import { GeminiProvider } from './gemini-provider'
import { CodexProvider } from './codex-provider'

export class AIProviderFactory {
  static create(providerType: AIProviderType): BaseAIProvider {
    switch (providerType) {
      case 'anthropic-api':
      case 'claude-oauth':
        return new ClaudeProvider(providerType)

      case 'gemini-cli':
      case 'admin-gemini':
        return new GeminiProvider(providerType)

      case 'codex-api':
      case 'codex-oauth':
        return new CodexProvider(providerType)

      default:
        throw new Error(`Unsupported AI provider: ${providerType}`)
    }
  }

  static isClaudeProvider(providerType: AIProviderType): boolean {
    return providerType === 'anthropic-api' || providerType === 'claude-oauth'
  }

  static isGeminiProvider(providerType: AIProviderType): boolean {
    return providerType === 'gemini-cli' || providerType === 'admin-gemini'
  }

  static isCodexProvider(providerType: AIProviderType): boolean {
    return providerType === 'codex-api' || providerType === 'codex-oauth'
  }
}
