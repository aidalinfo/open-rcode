<template>
  <div v-if="toolCount > 0">
    <UTree :items="treeItems" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  message: string
}

const props = defineProps<Props>()

const parseToolNames = (content: string): string[] => {
  const tools: string[] = []
  const explicitToolNames = new Set<string>()

  // Claude/MCP style tool markers
  const toolRegex = /(?:🔧|🔌)\s\*\*([^*]+)\*\*/g
  let match: RegExpExecArray | null
  while ((match = toolRegex.exec(content)) !== null) {
    if (match[1]) {
      const name = match[1].trim()
      explicitToolNames.add(name)
      tools.push(name)
    }
  }

  // Codex inspector style lines: `tool provider.action(...)`
  const codexToolRegex = /(?:^|\n)\s*tool\s+([a-z0-9_.-]+)/gi
  let codexMatch: RegExpExecArray | null
  while ((codexMatch = codexToolRegex.exec(content)) !== null) {
    const name = codexMatch[1]?.trim()
    if (name) {
      explicitToolNames.add(name)
      tools.push(name)
    }
  }

  // Inspector notes like `📝 provider.action(...) success ...`
  const noteRegex = /(?:^|\n)\s*📝\s*([a-z0-9_.-]+)/gi
  let noteMatch: RegExpExecArray | null
  while ((noteMatch = noteRegex.exec(content)) !== null) {
    const name = noteMatch[1]?.trim()
    if (!name) continue
    if (name.toLowerCase() === 'thinking') continue
    if (explicitToolNames.has(name)) continue
    explicitToolNames.add(name)
    tools.push(name)
  }

  // Codex-style inferred tools: bash executions and thinking traces
  // Count occurrences to reflect multiple uses in the tree
  // Match bash executions like "exec bash -lc ..." or "bash -lc ..." anywhere
  const bashRegex = /\bbash\s+-lc\b/gi
  // Match Codex thinking markers (with or without the 📝 prefix)
  const thinkingRegex = /(?:^|\n)\s*(?:📝\s*)?thinking\b/gi

  const bashMatches = content.match(bashRegex)
  if (bashMatches && bashMatches.length) {
    for (let i = 0; i < bashMatches.length; i++) tools.push('Bash')
  }

  const thinkingMatches = content.match(thinkingRegex)
  if (thinkingMatches && thinkingMatches.length) {
    for (let i = 0; i < thinkingMatches.length; i++) tools.push('Thinking')
  }

  return tools
}

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const getToolIcon = (toolName: string): string => {
  const normalized = toolName.trim()
  const lower = normalized.toLowerCase()
  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1)

  const baseIconMap: Record<string, string> = {
    Read: 'i-lucide-file-text',
    Edit: 'i-lucide-edit',
    MultiEdit: 'i-lucide-edit',
    Write: 'i-lucide-file-plus',
    Bash: 'i-lucide-terminal',
    bash: 'i-lucide-terminal',
    Thinking: 'i-lucide-brain',
    Grep: 'i-lucide-search',
    Glob: 'i-lucide-folder-open',
    LS: 'i-lucide-folder',
    Task: 'i-lucide-rocket',
    WebSearch: 'i-lucide-globe',
    WebFetch: 'i-lucide-download',
    TodoWrite: 'i-lucide-clipboard-list',
    NotebookRead: 'i-lucide-book-open',
    NotebookEdit: 'i-lucide-book',
    exec: 'i-lucide-code-xml',
    tool: 'i-lucide-wrench'
  }

  const providerIconMap: Record<string, string> = {
    nuxt: 'i-lucide-cube',
    mastra: 'i-lucide-database',
    openai: 'i-lucide-sparkles',
    vercel: 'i-lucide-cloud',
    github: 'i-lucide-github',
    default: 'i-lucide-cpu-chip'
  }

  if (baseIconMap[normalized]) {
    return baseIconMap[normalized]
  }
  if (baseIconMap[lower]) {
    return baseIconMap[lower]
  }
  if (baseIconMap[title]) {
    return baseIconMap[title]
  }

  const provider = lower.split('.')[0] || ''
  if (provider && providerIconMap[provider]) {
    return providerIconMap[provider]
  }

  if (provider) {
    return providerIconMap.default
  }

  return 'i-lucide-wrench'
}

const getToolStatus = (content: string, toolName: string): string => {
  // Chercher la section avec 🔧 ou 🔌
  let toolSection = content.split(`🔧 **${toolName}**`)[1]
  if (!toolSection) {
    toolSection = content.split(`🔌 **${toolName}**`)[1]
  }
  if (!toolSection) {
    const escaped = escapeRegExp(toolName)
    const directRegex = new RegExp(`(?:^|\n)\s*tool\s+${escaped}[^\n]*`, 'i')
    const noteRegex = new RegExp(`(?:^|\n)\s*📝\s*${escaped}[^\n]*`, 'i')
    const fallbackMatch = content.match(directRegex) || content.match(noteRegex)
    if (!fallbackMatch) {
      return ''
    }
    toolSection = content.slice(fallbackMatch.index || 0)
  }

  if (toolSection.includes('✅') || /success/i.test(toolSection)) return '✅'
  if (toolSection.includes('❌') || /fail|error/i.test(toolSection)) return '❌'
  return ''
}

const toolNames = computed(() => parseToolNames(props.message))
const toolCount = computed(() => toolNames.value.length)

const treeItems = computed(() => {
  if (toolCount.value === 0) return []

  const names = toolNames.value
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const n of names) {
    if (!counts.has(n)) order.push(n)
    counts.set(n, (counts.get(n) || 0) + 1)
  }

  const totalCalls = names.length

  return [{
    label: `${totalCalls} tool call${totalCalls > 1 ? 's' : ''}`,
    icon: 'i-lucide-wrench',
    defaultExpanded: true,
    children: order.map(toolName => {
      const count = counts.get(toolName) || 1
      const suffix = count > 1 ? ` (x${count})` : ''
      return {
        label: `${toolName}${suffix} ${getToolStatus(props.message, toolName)}`.trim(),
        icon: getToolIcon(toolName)
      }
    })
  }]
})
</script>
