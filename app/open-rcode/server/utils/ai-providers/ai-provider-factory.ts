import { BaseAIProvider, AIProviderType } from './base-ai-provider'
import { ClaudeProvider } from './claude-provider'
import { GeminiProvider } from './gemini-provider'

export class AIProviderFactory {
  static create(providerType: AIProviderType): BaseAIProvider {
    switch (providerType) {
      case 'anthropic-api':
      case 'claude-oauth':
        return new ClaudeProvider(providerType)
      
      case 'gemini-cli':
      case 'admin-gemini':
        return new GeminiProvider(providerType)
      
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
}