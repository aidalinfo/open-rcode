<template>
  <div class="tool-message-tree">
    <UTree :items="treeItems" :default-expanded="false" />
  </div>
</template>

<script setup lang="ts">
interface ToolCall {
  name: string
  params: Record<string, any>
  status: 'success' | 'error'
  result?: string
}

interface Props {
  message: string
}

const props = defineProps<Props>()

const parseToolCalls = (content: string): ToolCall[] => {
  const tools: ToolCall[] = []
  
  const toolRegex = /🔧\s\*\*([^*]+)\*\*([^🔧]*?)(?=🔧|$)/gs
  const matches = content.matchAll(toolRegex)
  
  for (const match of matches) {
    const toolName = match[1].trim()
    const toolContent = match[2].trim()
    
    const params: Record<string, any> = {}
    let status: 'success' | 'error' = 'success'
    let result = ''
    
    // Parse file paths
    const filePathMatch = toolContent.match(/📁\s*[^:]+:\s*`([^`]+)`/)
    if (filePathMatch) {
      params.file_path = filePathMatch[1]
    }
    
    // Parse commands
    const commandMatch = toolContent.match(/🖥️\s*[^:]+:\s*`([^`]+)`/)
    if (commandMatch) {
      params.command = commandMatch[1]
    }
    
    // Parse edit operations
    const editMatch = toolContent.match(/✏️\s*[^:]+:\s*`([^`]+)`/)
    if (editMatch) {
      params.file_path = editMatch[1]
    }
    
    // Parse status
    if (toolContent.includes('✅')) {
      status = 'success'
    } else if (toolContent.includes('❌')) {
      status = 'error'
    }
    
    // Extract result if any
    const lines = toolContent.split('\n')
    const statusLineIndex = lines.findIndex(line => line.includes('✅') || line.includes('❌'))
    if (statusLineIndex > 0 && statusLineIndex < lines.length - 1) {
      result = lines.slice(statusLineIndex + 1).join('\n').trim()
    }
    
    tools.push({
      name: toolName,
      params,
      status,
      result
    })
  }
  
  return tools
}

const getToolIcon = (toolName: string): string => {
  const iconMap: Record<string, string> = {
    'Read': 'i-heroicons-document-text',
    'Edit': 'i-heroicons-pencil-square',
    'MultiEdit': 'i-heroicons-pencil-square',
    'Write': 'i-heroicons-document-plus',
    'Bash': 'i-heroicons-command-line',
    'Grep': 'i-heroicons-magnifying-glass',
    'Glob': 'i-heroicons-folder-open',
    'LS': 'i-heroicons-folder',
    'Task': 'i-heroicons-rocket-launch',
    'WebSearch': 'i-heroicons-globe-alt',
    'WebFetch': 'i-heroicons-arrow-down-tray',
    'TodoWrite': 'i-heroicons-clipboard-document-list',
    'NotebookRead': 'i-heroicons-book-open',
    'NotebookEdit': 'i-heroicons-pencil'
  }
  return iconMap[toolName] || 'i-heroicons-wrench'
}

const formatParams = (params: Record<string, any>): string => {
  return Object.entries(params)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

const toolCalls = computed(() => parseToolCalls(props.message))

const treeItems = computed(() => {
  const toolCount = toolCalls.value.length
  
  if (toolCount === 0) return []
  
  return [{
    label: `${toolCount} outil${toolCount > 1 ? 's' : ''} utilisé${toolCount > 1 ? 's' : ''}`,
    icon: 'i-heroicons-wrench-screwdriver',
    children: toolCalls.value.map(tool => ({
      label: tool.name,
      icon: getToolIcon(tool.name),
      children: [
        {
          label: 'Paramètres',
          icon: 'i-heroicons-cog-6-tooth',
          children: Object.entries(tool.params).map(([key, value]) => ({
            label: `${key}: ${value}`,
            icon: 'i-heroicons-chevron-right'
          }))
        },
        {
          label: `Status: ${tool.status === 'success' ? '✅ Succès' : '❌ Échec'}`,
          icon: tool.status === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'
        }
      ]
    }))
  }]
})
</script>

<style scoped>
@import "tailwindcss";
@reference "tailwindcss/utilities.css";

.tool-message-tree {
  @apply rounded-lg border bg-gray-50 dark:bg-gray-800 p-3;
}
</style>