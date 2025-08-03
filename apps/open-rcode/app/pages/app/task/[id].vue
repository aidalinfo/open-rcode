<template>
  <UDashboardPanel>
    
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
              <div v-if="isPRLink(message)" class="pr-link-message">
                <div class="flex flex-col gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <div class="flex items-center gap-3">
                    <UIcon name="i-lucide-git-branch" class="w-5 h-5 text-green-600" />
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
              <ToolMessageTree v-else-if="message.type === 'tools'" :message="message.content" />
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

// Inject the setPageTitle function from layout
const pageTitle = usePageTitle()
const navbarBadge = useNavbarBadge()

let pollInterval: NodeJS.Timeout | null = null

// Chat status mapping
const chatStatus = computed(() => {
  if (loading.value) return 'submitted'
  if (error.value) return 'error'
  if (isTaskRunning.value) return 'streaming'
  return 'ready'
})

// Format messages for UChatMessages component
const formattedMessages = computed(() => {
  const grouped: any[] = []
  let currentToolGroup: any = null
  
  for (const message of messages.value) {
    if (isToolMessage(message)) {
      // Si c'est un message outil
      if (currentToolGroup) {
        // Ajouter à l'outil en cours
        currentToolGroup.content += '\n' + message.content
      } else {
        // Créer un nouveau groupe d'outils
        currentToolGroup = {
          id: message._id || Math.random(),
          role: message.role,
          content: message.content,
          timestamp: message.timestamp || new Date(),
          type: 'tools' as any
        }
      }
    } else {
      // Si ce n'est pas un message outil, finaliser le groupe précédent
      if (currentToolGroup) {
        grouped.push(currentToolGroup)
        currentToolGroup = null
      }
      
      // Ajouter le message normal
      grouped.push({
        id: message._id || Math.random(),
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || new Date(),
        type: message.type as any
      })
    }
  }
  
  // Finaliser le dernier groupe d'outils si nécessaire
  if (currentToolGroup) {
    grouped.push(currentToolGroup)
  }
  
  return grouped
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

// Helper function to detect tool messages
const isToolMessage = (message: any) => {
  return message.role === 'assistant' && 
    typeof message.content === 'string' && 
    message.content.includes('🔧 **')
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
    pageTitle.value = task.value.name || `Task: ${task.value.id}`
    navbarBadge.value = {
      label: getStatusLabel(task.value.status),
      color: getStatusColor(task.value.status),
      variant: 'solid'
    }

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
  navbarBadge.value = null
})
</script>

