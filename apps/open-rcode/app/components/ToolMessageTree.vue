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

  // Claude/MCP style tool markers
  const toolRegex = /(?:🔧|🔌)\s\*\*([^*]+)\*\*/g
  let match
  while ((match = toolRegex.exec(content)) !== null) {
    if (match[1]) tools.push(match[1].trim())
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

const getToolIcon = (toolName: string): string => {
  const iconMap: Record<string, string> = {
    Read: 'i-lucide-file-text',
    Edit: 'i-lucide-edit',
    MultiEdit: 'i-lucide-edit',
    Write: 'i-lucide-file-plus',
    Bash: 'i-lucide-terminal',
    Thinking: 'i-lucide-brain',
    Grep: 'i-lucide-search',
    Glob: 'i-lucide-folder-open',
    LS: 'i-lucide-folder',
    Task: 'i-lucide-rocket',
    WebSearch: 'i-lucide-globe',
    WebFetch: 'i-lucide-download',
    TodoWrite: 'i-lucide-clipboard-list',
    NotebookRead: 'i-lucide-book-open',
    NotebookEdit: 'i-lucide-book'
  }
  return iconMap[toolName] || 'i-lucide-wrench'
}

const getToolStatus = (content: string, toolName: string): string => {
  // Chercher la section avec 🔧 ou 🔌
  let toolSection = content.split(`🔧 **${toolName}**`)[1]
  if (!toolSection) {
    toolSection = content.split(`🔌 **${toolName}**`)[1]
  }
  if (!toolSection) return ''

  if (toolSection.includes('✅')) return '✅'
  if (toolSection.includes('❌')) return '❌'
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
