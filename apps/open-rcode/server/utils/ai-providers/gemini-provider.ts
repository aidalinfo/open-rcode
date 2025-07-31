import { BaseAIProvider, AIProviderType, AICommandOptions, ParsedOutput } from './base-ai-provider'
import { AICommandBuilder } from './ai-command-builder'

export class GeminiProvider extends BaseAIProvider {
  getName(): string {
    return this.providerType === 'admin-gemini' ? 'Gemini Admin' : 'Gemini'
  }

  getEnvironmentSetup(): string {
    if (this.providerType === 'admin-gemini') {
      return `export GEMINI_API_KEY="${process.env.ADMIN_GOOGLE_API_KEY}"`
    }
    return 'export GEMINI_API_KEY="$GEMINI_API_KEY"'
  }

  buildCommand(options: AICommandOptions, prompt: string): string {
    const builder = AICommandBuilder.create('gemini')
    
    builder.withModel(options.model)
    builder.withPrompt(prompt)

    return builder.build()
  }

  parseOutput(rawOutput: string): ParsedOutput {
    // Gemini doesn't output JSON, so we return the raw output
    return {
      toolCalls: [],
      textMessages: rawOutput ? [rawOutput] : [],
      finalResult: rawOutput || 'Tâche terminée'
    }
  }

  supportsStreaming(): boolean {
    return false // Gemini CLI doesn't support JSON streaming
  }

  supportsPlanMode(): boolean {
    return false // Gemini doesn't support plan mode
  }
}