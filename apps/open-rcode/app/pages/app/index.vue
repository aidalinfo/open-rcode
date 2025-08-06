<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <AppSkeleton v-if="isInitialLoading" />
        
        <div v-else class="min-h-screen flex mt-12 justify-center">
          <div class="w-full max-w-4xl space-y-8">
            <WelcomeModal v-model="showWelcomeModal" />
            
            <!-- Recent Tasks Cards -->
            <div v-if="recentTasks.length > 0" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <TaskCard 
                  v-for="(task, index) in recentTasks" 
                  :key="task._id"
                  :task="task"
                  :class="{ 'hidden lg:block': index === 2 }"
                  @click="navigateToTask(task._id)"
                />
              </div>
            </div>
            
            <ChatPrompt
              v-model:input="input"
              v-model:selectedEnvironment="selectedEnvironment"
              :environments="environments"
              :loading="loading"
              @submit="onSubmit"
            />

            <div v-if="environments.length === 0" class="text-center py-8">
              <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No configured environments
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Create your first environment to start using the chat.
              </p>
              <UButton
                to="/app/settings/environnement/create"
                icon="i-heroicons-plus"
              >
                Create an environment
              </UButton>
            </div>
          </div>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import type { TaskCard } from '~/shared/types/task'

const toast = useToast()
const router = useRouter()
const pageTitle = usePageTitle()
pageTitle.value = "Prompting"
// États réactifs
const input = ref('')
const loading = ref(false)
const environments = ref<any[]>([])
const selectedEnvironment = ref('')
const isInitialLoading = ref(true)
const showWelcomeModal = ref(false)
const recentTasks = ref<TaskCard[]>([])

// Méthodes
const fetchEnvironments = async () => {
  try {
    const data = await $fetch<{ environments: any[] }>('/api/environments')
    environments.value = data.environments
    
    // Show welcome modal if no environments
    if (data.environments.length === 0) {
      showWelcomeModal.value = true
    }
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching environments:', error)
  }
}

const fetchRecentTasks = async () => {
  try {
    const data = await $fetch<{ tasks: TaskCard[] }>('/api/tasks?limit=3&page=1')
    recentTasks.value = data.tasks
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching recent tasks:', error)
  }
}

const navigateToTask = (taskId: string) => {
  router.push(`/app/task/${taskId}`)
}

const onSubmit = async (data: { message: string; environmentId: string; task?: any }) => {
  if (!data.task || !data.task.id) {
    toast.add({ title: 'Error', description: 'Task creation failed.', color: 'error' })
    return
  }

  loading.value = true

  try {
    // Redirect immediately to the task page
    router.push(`/app/task/${data.task.id}`)

    // Launch container creation in the background, without waiting
    $fetch(`/api/tasks/${data.task.id}/container`, {
      method: 'POST'
    }).catch((error) => {
      if (import.meta.dev) console.error('Error creating container in background:', error)
      // Don't show error toast if it's just a conflict (409)
      // or if the task already has a container
      if (error.statusCode !== 409) {
        toast.add({
          title: 'Container Error',
          description: 'Docker environment creation failed in the background.',
          color: 'error',
          duration: 0
        })
      }
    })
  } catch (error) {
    if (import.meta.dev) console.error('Error during redirect or fetch call:', error)
    toast.add({ title: 'Error', description: 'An error occurred.', color: 'error' })
    loading.value = false
  }
  // loading.value is not set to false here because the page is changing.
}

// Initial loading
onBeforeMount(async () => {
  await Promise.all([
    fetchEnvironments(),
    fetchRecentTasks()
  ])
  isInitialLoading.value = false
})
</script>