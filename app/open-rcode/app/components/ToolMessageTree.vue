<script setup lang="ts">
interface ToolExecution {
  name: string
  params: any
  result?: string
  error?: string
}

interface Props {
  tools: ToolExecution[]
}

const props = defineProps<Props>()

const getToolIcon = (toolName: string) => {
  const iconMap: Record<string, string> = {
    'Read': 'i-heroicons-document-text',
    'Edit': 'i-heroicons-pencil',
    'Write': 'i-heroicons-document-plus',
    'Bash': 'i-heroicons-command-line',
    'Search': 'i-heroicons-magnifying-glass',
    'Grep': 'i-heroicons-magnifying-glass-circle',
    'Glob': 'i-heroicons-folder-open',
    'LS': 'i-heroicons-folder',
    'Task': 'i-heroicons-clipboard-document-list',
    'TodoWrite': 'i-heroicons-clipboard-document-check',
    'WebFetch': 'i-heroicons-globe-alt',
    'WebSearch': 'i-heroicons-globe-europe-africa',
    'NotebookRead': 'i-heroicons-book-open',
    'NotebookEdit': 'i-heroicons-pencil-square',
    'MultiEdit': 'i-heroicons-pencil-square',
    'ExitPlanMode': 'i-heroicons-arrow-right-on-rectangle'
  }
  return iconMap[toolName] || 'i-heroicons-wrench'
}

const items = computed(() => {
  const toolGroups = props.tools.reduce((acc, tool) => {
    if (!acc[tool.name]) {
      acc[tool.name] = []
    }
    acc[tool.name].push(tool)
    return acc
  }, {} as Record<string, ToolExecution[]>)

  return [{
    label: `${props.tools.length} outil${props.tools.length > 1 ? 's' : ''} utilisé${props.tools.length > 1 ? 's' : ''}`,
    icon: 'i-heroicons-wrench-screwdriver',
    defaultExpanded: false,
    children: Object.entries(toolGroups).map(([toolName, executions]) => ({
      label: `${toolName} (${executions.length})`,
      icon: getToolIcon(toolName),
      defaultExpanded: false,
      children: executions.map((execution, index) => ({
        label: `Exécution ${index + 1}`,
        icon: execution.error ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle',
        slot: `${toolName}-${index}`,
        execution
      }))
    }))
  }]
})

const formatParams = (params: any) => {
  if (typeof params === 'string') return params
  return JSON.stringify(params, null, 2)
}

const formatResult = (result: string | undefined) => {
  if (!result) return 'Aucun résultat'
  if (result.length > 500) {
    return result.substring(0, 500) + '...'
  }
  return result
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
    <UTree :items="items" :ui="{ wrapper: 'space-y-1' }">
      <template v-for="[toolName, executions] in Object.entries(tools.reduce((acc, tool) => {
        if (!acc[tool.name]) acc[tool.name] = []
        acc[tool.name].push(tool)
        return acc
      }, {}))" :key="toolName">
        <template v-for="(execution, index) in executions" :key="index" #[`${toolName}-${index}`]>
          <div class="ml-8 mt-2 space-y-2 text-sm">
            <div class="space-y-1">
              <div class="font-medium text-gray-700 dark:text-gray-300">Paramètres :</div>
              <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">{{ formatParams(execution.params) }}</pre>
            </div>
            <div v-if="execution.result" class="space-y-1">
              <div class="font-medium text-gray-700 dark:text-gray-300">Résultat :</div>
              <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{{ formatResult(execution.result) }}</pre>
            </div>
            <div v-if="execution.error" class="space-y-1">
              <div class="font-medium text-red-600 dark:text-red-400">Erreur :</div>
              <pre class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-2 rounded text-xs overflow-x-auto">{{ execution.error }}</pre>
            </div>
          </div>
        </template>
      </template>
    </UTree>
  </div>
</template>