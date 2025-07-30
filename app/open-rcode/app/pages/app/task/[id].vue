<template>
  <UDashboardPanel>
    <template #header>
      <div class="flex items-center justify-center gap-4">
        <h1 class="text-xl font-semibold">
          {{ task ? `Task: ${task.name || task.id}` : 'Loading...' }}
        </h1>
        <UBadge v-if="task" :color="getStatusColor(task.status)" :label="getStatusLabel(task.status)" />
      </div>
    </template>
    
    <template #body>
      <UContainer class="flex flex-col h-full px-4">
        <div v-if="loading" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto text-gray-400 animate-spin" />
            <p class="mt-2">Loading task...</p>
          </div>
        </div>

        <div v-else-if="error" class="flex-1 flex items-center justify-center">
          <div class="text-center text-red-500">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 mx-auto mb-2" />
            <p>{{ error }}</p>
          </div>
        </div>

        <div v-else-if="task" class="flex flex-col h-full">
          <UChatMessages
            :assistant="{
              side: 'left',
              variant: 'outline',
              avatar: {
                icon: 'i-lucide-bot'
              },
              actions: [
                {
                  label: 'Copy',
                  icon: 'i-lucide-copy'
                }
              ]
            }"
            :user="{
              side: 'right',
              variant: 'solid',
              avatar: {
                icon: 'i-lucide-user'
              },
              actions: [
                {
                  label: 'Copy',
                  icon: 'i-lucide-copy'
                }
              ]
            }"
            :messages="formattedMessages"
            :status="chatStatus"
            class="flex-1"
          >
            <template #content="{ message }">
              <div v-if="message.type === 'tool-group'" class="tool-group-message">
                <ToolMessageTree :tools="message.tools" />
              </div>
              <div v-else-if="isPRLink(message)" class="pr-link-message">
                <div class="flex flex-col gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <div class="flex items-center gap-3">
                    <UIcon name="i-heroicons-git-branch" class="w-5 h-5 text-green-600" />
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Pull Request created</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ message.content }}</p>
                    </div>
                  </div>
                  <UButton
                    @click="openGitHubPR(message.content)"
                    icon="i-simple-icons-github"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    label="Open"
                    target="_blank"
                    class="w-full sm:w-auto"
                  />
                </div>
              </div>
              <MDC v-else :value="message.content" :cache-key="message.id" unwrap="p" />
            </template>
          </UChatMessages>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const taskId = route.params.id as string

const task = ref<any>(null)
const messages = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const isTaskRunning = ref(true)

let pollInterval: NodeJS.Timeout | null = null

// Chat status mapping
const chatStatus = computed(() => {
  if (loading.value) return 'submitted'
  if (error.value) return 'error'
  if (isTaskRunning.value) return 'streaming'
  return 'ready'
})

// Helper to detect tool messages
const isToolMessage = (content: string) => {
  return typeof content === 'string' && (content.includes('🔧') || content.includes('⚙️'))
}

// Helper to parse tool message
const parseToolMessage = (content: string) => {
  const toolMatch = content.match(/🔧\s*(\w+)/)
  const toolName = toolMatch ? toolMatch[1] : 'Unknown'
  
  // Extract parameters
  const paramsMatch = content.match(/Parameters:?\s*```(?:json)?\s*([\s\S]*?)```/i)
  const params = paramsMatch ? JSON.parse(paramsMatch[1]) : {}
  
  // Extract result
  const resultMatch = content.match(/Result:?\s*([\s\S]*?)(?=\n\n|$)/i)
  const result = resultMatch ? resultMatch[1].trim() : undefined
  
  // Check for error
  const errorMatch = content.match(/Error:?\s*([\s\S]*?)(?=\n\n|$)/i)
  const error = errorMatch ? errorMatch[1].trim() : undefined
  
  return { name: toolName, params, result, error }
}

// Format messages for UChatMessages component
const formattedMessages = computed(() => {
  const result = []
  let toolGroup = []
  
  for (let i = 0; i < messages.value.length; i++) {
    const message = messages.value[i]
    
    if (message.role === 'assistant' && isToolMessage(message.content)) {
      // Accumulate tool messages
      toolGroup.push(parseToolMessage(message.content))
    } else {
      // If we have accumulated tools, add them as a group
      if (toolGroup.length > 0) {
        result.push({
          id: `tool-group-${i}`,
          role: 'assistant',
          content: '', // Will be handled by custom template
          timestamp: messages.value[i - 1]?.timestamp || new Date(),
          type: 'tool-group',
          tools: [...toolGroup]
        })
        toolGroup = []
      }
      
      // Add the regular message
      result.push({
        id: message._id || i,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || new Date(),
        type: message.type
      })
    }
  }
  
  // Handle any remaining tool messages
  if (toolGroup.length > 0) {
    result.push({
      id: `tool-group-final`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      type: 'tool-group',
      tools: toolGroup
    })
  }
  
  return result
})

// Helper function to detect PR links
const isPRLink = (message: any) => {
  return message.type === 'pr_link' || (
    message.role === 'assistant' && 
    typeof message.content === 'string' && 
    message.content.includes('github.com') && 
    message.content.includes('/pull/')
  )
}

// Function to open GitHub PR
const openGitHubPR = (url: string) => {
  window.open(url, '_blank')
}

// Status helpers
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'error'
    case 'running': return 'warning'
    default: return 'neutral'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    case 'running': return 'Running'
    case 'pending': return 'Pending'
    default: return 'Unknown'
  }
}

// Avatar configuration
const getMessageAvatar = (role: string) => {
  if (role === 'user') {
    return { icon: 'i-heroicons-user' }
  }
  return { icon: 'i-heroicons-cpu-chip' }
}

// Message actions
const messageActions = [
  {
    icon: 'i-heroicons-clipboard',
    label: 'Copier',
    click: (message: any) => {
      navigator.clipboard.writeText(message.content)
    }
  }
]

const fetchTaskAndMessages = async () => {
  try {
    // Fetch task details
    const taskData = await $fetch(`/api/tasks/${taskId}`)
    task.value = taskData.task

    // Fetch messages
    const messagesData = await $fetch(`/api/tasks/${taskId}/messages`)
    messages.value = messagesData.messages

    // Check if the task is still running
    if (task.value.status === 'completed' || task.value.status === 'failed') {
      isTaskRunning.value = false
      if (pollInterval) clearInterval(pollInterval)
    }

  } catch (err) {
    if (import.meta.dev) console.error('Error fetching data:', err)
    error.value = 'Unable to load task information.'
    if (pollInterval) clearInterval(pollInterval)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTaskAndMessages()
  pollInterval = setInterval(fetchTaskAndMessages, 3000) // Poll every 3 seconds
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

