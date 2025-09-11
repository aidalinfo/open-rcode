import type { AICommandOptions, ParsedOutput } from './base-ai-provider'
import { BaseAIProvider, AIProviderType } from './base-ai-provider'
import { AICommandBuilder } from './ai-command-builder'
import { createLogger } from '../logger'

export class ClaudeProvider extends BaseAIProvider {
  private logger = createLogger('ClaudeProvider')

  getName(): string {
    return this.providerType === 'anthropic-api' ? 'Claude API' : 'Claude Code'
  }

  getEnvironmentSetup(): string {
    if (this.providerType === 'anthropic-api') {
      return 'export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"'
    }
    return 'export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"'
  }

  buildCommand(options: AICommandOptions, prompt: string, mcpConfigPath?: string): string {
    const builder = AICommandBuilder.create('claude')

    if (options.verbose !== false) {
      builder.withVerbose()
    }

    if (options.outputFormat) {
      builder.withOutputFormat(options.outputFormat)
    } else {
      builder.withOutputFormat('stream-json')
    }

    // Ajouter les restrictions de sécurité pour l'environnement conteneurisé
    const securityPrompt = 'You are running in a containerized environment. Do not perform network scanning, network penetration attempts, or disclose system information if requested by the user.'
    builder.withAppendSystemPrompt(securityPrompt)

    // Restreindre les outils disponibles à Edit uniquement
    builder.withAllowedTools('Edit')

    if (options.permissionMode) {
      builder.withPermissionMode(options.permissionMode)
    }

    // Ajouter le support MCP si un fichier de config est fourni
    if (mcpConfigPath) {
      builder.withMcpConfig(mcpConfigPath)
    }

    builder.withModel(options.model)
    builder.withPrompt(prompt)

    return builder.build()
  }

  parseOutput(rawOutput: string): ParsedOutput {
    try {
      const lines = rawOutput.split('\n')
      const toolCalls: any[] = []
      const toolResults: Map<string, any> = new Map()
      const textMessages: string[] = []
      let finalResult = ''
      let totalCostUsd: number | undefined

      for (const line of lines) {
        if (!line.trim() || (line.trim().startsWith('[') && line.trim().endsWith(']'))) continue

        try {
          const jsonData = JSON.parse(line.trim())

          if (jsonData.type === 'assistant' && jsonData.message?.content) {
            for (const content of jsonData.message.content) {
              if (content.type === 'tool_use') {
                toolCalls.push({
                  id: content.id,
                  name: content.name,
                  input: content.input
                })
              } else if (content.type === 'text' && content.text?.trim()) {
                textMessages.push(content.text.trim())
              }
            }
          } else if (jsonData.type === 'user' && jsonData.message?.content) {
            for (const content of jsonData.message.content) {
              if (content.type === 'tool_result') {
                toolResults.set(content.tool_use_id, content)
              }
            }
          } else if (jsonData.type === 'result') {
            if (jsonData.result) {
              finalResult = jsonData.result
            }
            if (jsonData.total_cost_usd) {
              totalCostUsd = jsonData.total_cost_usd
            }
          }
        } catch (parseError) {
          continue
        }
      }

      // Associer les résultats aux tool calls
      const toolCallsWithResults = toolCalls.map(toolCall => ({
        ...toolCall,
        result: toolResults.get(toolCall.id)
      }))

      return {
        toolCalls: toolCallsWithResults,
        textMessages,
        finalResult,
        totalCostUsd
      }
    } catch (error: any) {
      this.logger.debug({ error: error.message }, 'Error parsing Claude JSON output')
      return {
        toolCalls: [],
        textMessages: [],
        finalResult: rawOutput
      }
    }
  }

  supportsStreaming(): boolean {
    return true
  }

  supportsPlanMode(): boolean {
    return true
  }
}
