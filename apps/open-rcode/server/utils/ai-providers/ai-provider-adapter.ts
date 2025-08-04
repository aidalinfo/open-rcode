import { BaseAIProvider, AIProviderType, ExecuteOptions, ParsedOutput } from './base-ai-provider'
import { AIProviderFactory } from './ai-provider-factory'
import { ContainerScripts } from '../container-scripts'
import { createLogger } from '../logger'

interface ExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
}

export class AIProviderAdapter {
  private provider: BaseAIProvider
  private logger = createLogger('AIProviderAdapter')

  constructor(providerType: AIProviderType) {
    this.provider = AIProviderFactory.create(providerType)
  }

  getName(): string {
    return this.provider.getName()
  }

  supportsStreaming(): boolean {
    return this.provider.supportsStreaming()
  }

  supportsPlanMode(): boolean {
    return this.provider.supportsPlanMode()
  }

  buildExecutionScript(options: ExecuteOptions): string {
    const cliName = AIProviderFactory.isGeminiProvider(this.provider['providerType']) ? 'gemini' : 'claude'
    
    const command = this.provider.buildCommand({
      model: options.model,
      verbose: true,
      outputFormat: this.provider.supportsStreaming() ? 'stream-json' : 'text',
      permissionMode: options.planMode ? 'plan' : 'normal'
    }, options.prompt)

    return ContainerScripts.buildExecutionScript(
      options.workdir,
      this.provider.getEnvironmentSetup(),
      cliName,
      command
    )
  }

  parseOutput(rawOutput: string): ParsedOutput {
    // Remove unwanted path from the beginning
    const unwantedPathPattern = /^\/root\/\.nvm\/versions\/node\/v[\d.]+\/bin\/(claude|gemini)\s*\n?/
    const filteredOutput = rawOutput.replace(unwantedPathPattern, '')
    
    return this.provider.parseOutput(filteredOutput)
  }

  formatToolCall(toolCall: any): string {
    const parts: string[] = []
    
    // Détection des outils MCP
    const isMcpTool = toolCall.name.startsWith('mcp__') || toolCall.name.startsWith('mcp_') || toolCall.name.startsWith('mcp')
    
    if (isMcpTool) {
      parts.push(`🔌 **${toolCall.name}** (MCP)`)
    } else {
      parts.push(`🔧 **${toolCall.name}**`)
    }
    
    if (toolCall.input) {
      const inputEntries = Object.entries(toolCall.input)
      
      if (inputEntries.length === 1) {
        const [key, value] = inputEntries[0]
        
        if (key === 'file_path') {
          const emoji = toolCall.name === 'Read' ? '📁' : toolCall.name === 'Write' ? '📝' : toolCall.name === 'Edit' ? '✏️' : '📄'
          const action = toolCall.name === 'Read' ? 'Lecture' : toolCall.name === 'Write' ? 'Écriture' : toolCall.name === 'Edit' ? 'Édition' : 'Fichier'
          parts.push(`   ${emoji} ${action}: \`${value}\``)
        } else if (key === 'command') {
          parts.push(`   💻 Commande: \`${value}\``)
        } else if (key === 'path') {
          parts.push(`   📂 Chemin: \`${value}\``)
        } else if (key === 'pattern') {
          parts.push(`   🔍 Motif: \`${value}\``)
        } else if (key === 'url') {
          parts.push(`   🌐 URL: \`${value}\``)
        } else if (key === 'query') {
          parts.push(`   🔎 Recherche: \`${value}\``)
        } else if (key === 'todos' && Array.isArray(value)) {
          parts.push(`   📝 Todos: ${value.length} tâches`)
        } else {
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              parts.push(`   ⚙️ ${key}: ${value.length} éléments`)
            } else {
              const formattedValue = JSON.stringify(value, null, 2).replace(/\n/g, ' ').replace(/\s+/g, ' ')
              if (formattedValue.length > 100) {
                parts.push(`   ⚙️ ${key}: ${formattedValue.substring(0, 100)}...`)
              } else {
                parts.push(`   ⚙️ ${key}: ${formattedValue}`)
              }
            }
          } else {
            parts.push(`   ⚙️ ${key}: \`${value}\``)
          }
        }
      } else if (inputEntries.length > 1) {
        parts.push(`   ⚙️ Paramètres: ${inputEntries.map(([key, value]) => {
          const formattedValue = typeof value === 'object' ? JSON.stringify(value, null, 2).replace(/\n/g, ' ').replace(/\s+/g, ' ') : value
          return `${key}=${formattedValue}`
        }).join(', ')}`)
      }
    }
    
    if (toolCall.result) {
      if (toolCall.result.is_error) {
        parts.push(`   ❌ Erreur: ${toolCall.result.content}`)
      } else if (toolCall.result.content && toolCall.result.content.length < 200) {
        parts.push(`   ✅ Résultat: ${toolCall.result.content}`)
      } else {
        parts.push(`   ✅ Succès`)
      }
    }
    
    return parts.join('\n')
  }
}