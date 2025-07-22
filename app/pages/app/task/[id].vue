<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-6">
          <div v-if="loading" class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto text-gray-400 animate-spin" />
            <p class="mt-2">Chargement de la tâche...</p>
          </div>

          <div v-if="error" class="text-center text-red-500">
            <p>{{ error }}</p>
          </div>

          <div v-if="task && !loading" class="space-y-4">
            <h1 class="text-2xl font-bold">Tâche: {{ task.id }}</h1>
            
            <div class="space-y-4">
              <div v-for="message in messages" :key="message.id" class="message-bubble" :class="`message-${message.role}`">
                <p v-if="message.role === 'user'" class="font-bold">Vous:</p>
                <p v-else class="font-bold">Assistant:</p>
                <pre class="whitespace-pre-wrap font-sans">{{ message.content }}</pre>
              </div>
            </div>

            <div v-if="isTaskRunning" class="text-center py-4">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 mx-auto text-gray-400 animate-spin" />
              <p class="mt-2 text-sm text-gray-500">Exécution en cours...</p>
            </div>
          </div>
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

<style scoped>
.message-bubble {
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}
.message-user {
  background-color: #e2e8f0; /* light gray */
}
.dark .message-user {
  background-color: #4a5568; /* darker gray */
}
.message-assistant {
  background-color: #f0f9ff; /* light blue */
}
.dark .message-assistant {
  background-color: #2c5282; /* darker blue */
}
</style>