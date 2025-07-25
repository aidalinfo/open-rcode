<template>
  <UDashboardPanel>
    <template #header>
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">
          {{ task ? `Tâche: ${task.name || task.id}` : 'Chargement...' }}
        </h1>
        <UBadge v-if="task" :color="getStatusColor(task.status)" :label="getStatusLabel(task.status)" />
      </div>
    </template>
    
    <template #body>
      <UContainer class="flex flex-col h-full px-4">
        <div v-if="loading" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto text-gray-400 animate-spin" />
            <p class="mt-2">Chargement de la tâche...</p>
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
                  label: 'Copier',
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
                  label: 'Copier',
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
                <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <UIcon name="i-heroicons-git-branch" class="w-5 h-5 text-green-600" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Pull Request créée</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ message.content }}</p>
                  </div>
                  <UButton
                    @click="openGitHubPR(message.content)"
                    icon="i-simple-icons-github"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    label="Ouvrir"
                    target="_blank"
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

// Format messages for UChatMessages component
const formattedMessages = computed(() => {
  return messages.value.map((message, index) => ({
    id: message._id || index,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || new Date(),
    type: message.type
  }))
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
    case 'completed': return 'Terminée'
    case 'failed': return 'Échouée'
    case 'running': return 'En cours'
    case 'pending': return 'En attente'
    default: return 'Inconnue'
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
    console.error('Erreur lors de la récupération des données:', err)
    error.value = 'Impossible de charger les informations de la tâche.'
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

