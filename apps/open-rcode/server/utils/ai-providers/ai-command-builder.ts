export class AICommandBuilder {
  private command: string
  private args: string[] = []
  private prompt?: string

  constructor(baseCommand: string) {
    this.command = baseCommand
  }

  static create(baseCommand: string): AICommandBuilder {
    return new AICommandBuilder(baseCommand)
  }

  withVerbose(): AICommandBuilder {
    this.args.push('--verbose')
    return this
  }

  withOutputFormat(format: 'stream-json' | 'text'): AICommandBuilder {
    this.args.push('--output-format', format)
    return this
  }

  withPermissionMode(mode: 'plan' | 'normal'): AICommandBuilder {
    if (mode === 'plan') {
      this.args.push('--permission-mode', 'plan')
    }
    return this
  }

  withModel(model?: string): AICommandBuilder {
    if (model) {
      this.args.push('--model', model)
    }
    return this
  }

  withPrompt(prompt: string): AICommandBuilder {
    this.prompt = prompt
    return this
  }

  withAppendSystemPrompt(systemPrompt: string): AICommandBuilder {
    this.args.push('--append-system-prompt', `"${systemPrompt}"`)
    return this
  }

  build(): string {
    const fullCommand = [this.command, ...this.args].join(' ')
    
    if (!this.prompt) {
      throw new Error('Prompt is required')
    }

    // -p must always be last
    return `${fullCommand} -p "$(cat <<'PROMPT_EOF'
${this.prompt}
PROMPT_EOF
)"`
  }

  buildWithoutPrompt(): string {
    return [this.command, ...this.args].join(' ')
  }
}