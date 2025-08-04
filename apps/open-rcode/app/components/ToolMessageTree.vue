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
  const toolRegex = /(?:🔧|🔌)\s\*\*([^*]+)\*\*/g
  let match
  
  while ((match = toolRegex.exec(content)) !== null) {
    if (match[1]) {
      tools.push(match[1].trim())
    }
  }
  
  return tools
}

const getToolIcon = (toolName: string): string => {
  const iconMap: Record<string, string> = {
    'Read': 'i-lucide-file-text',
    'Edit': 'i-lucide-edit',
    'MultiEdit': 'i-lucide-edit',
    'Write': 'i-lucide-file-plus',
    'Bash': 'i-lucide-terminal',
    'Grep': 'i-lucide-search',
    'Glob': 'i-lucide-folder-open',
    'LS': 'i-lucide-folder',
    'Task': 'i-lucide-rocket',
    'WebSearch': 'i-lucide-globe',
    'WebFetch': 'i-lucide-download',
    'TodoWrite': 'i-lucide-clipboard-list',
    'NotebookRead': 'i-lucide-book-open',
    'NotebookEdit': 'i-lucide-book'
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
  
  return [{
    label: `${toolCount.value} tool${toolCount.value > 1 ? 's' : ''} used`,
    icon: 'i-lucide-wrench',
    defaultExpanded: true,
    children: toolNames.value.map(toolName => ({
      label: `${toolName} ${getToolStatus(props.message, toolName)}`,
      icon: getToolIcon(toolName)
    }))
  }]
})
</script>