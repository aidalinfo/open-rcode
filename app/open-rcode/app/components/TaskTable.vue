<template>
  <UCard class="mt-6">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Tâches récentes
        </h3>
        <UIcon name="i-heroicons-clock" class="w-5 h-5 text-gray-400" />
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
    </div>

    <div v-else-if="tasks.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-document-text" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <p class="text-gray-600 dark:text-gray-400">
        Aucune tâche n'a encore été exécutée.
      </p>
    </div>

    <UTable
      v-else
      :data="tasks"
      :columns="columns"
      :loading="loading"
      class="w-full"
    >
      <template #name-cell="{ row }">
        <div class="font-medium text-gray-900 dark:text-white truncate max-w-xs">
          {{ row.original.name }}
        </div>
      </template>

      <template #status-cell="{ row }">
        <UBadge
          :color="getStatusColor(row.original)"
          :variant="row.original.status === 'completed' || row.original.status === 'failed' ? 'solid' : 'soft'"
          size="xs"
        >
          {{ getStatusText(row.original) }}
        </UBadge>
      </template>

      <template #environment-cell="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
          {{ row.original.environment?.name || 'N/A' }}
        </div>
      </template>

      <template #createdAt-cell="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ formatDate(row.original.createdAt) }}
        </div>
      </template>

      <template #pr-cell="{ row }">
        <div v-if="row.original.pr">
          <UButton
            :to="row.original.pr.url"
            target="_blank"
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-top-right-on-square"
          >
            PR #{{ row.original.pr.number }}
          </UButton>
        </div>
        <div v-else class="text-sm text-gray-400">
          -
        </div>
      </template>

      <template #actions-cell="{ row }">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-heroicons-chat-bubble-left-ellipsis"
          @click="viewTask(row.original._id)"
        >
          Voir
        </UButton>
      </template>
    </UTable>
  </UCard>
</template>

<script setup lang="ts">
const router = useRouter()

interface Task {
  _id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  executed: boolean
  merged: boolean
  createdAt: string
  environment?: {
    name: string
  }
  pr?: {
    url: string
    number: number
  }
  error?: string
}

// États réactifs
const tasks = ref<Task[]>([])
const loading = ref(false)

// Configuration du tableau
const columns = [
  {
    id: 'name',
    header: 'Tâche'
  },
  {
    id: 'status',
    header: 'Statut'
  },
  {
    id: 'environment',
    header: 'Environnement'
  },
  {
    id: 'createdAt',
    header: 'Créée le'
  },
  {
    id: 'pr',
    header: 'Pull Request'
  },
  {
    id: 'actions',
    header: 'Actions'
  }
]

// Méthodes
const fetchTasks = async () => {
  loading.value = true
  try {
    console.log('FETCHING TASKS...')
    const data = await $fetch('/api/tasks')
    console.log('TASKS DATA RECEIVED:', data)
    console.log('- tasks array:', data.tasks)
    console.log('- tasks length:', data.tasks?.length || 0)
    tasks.value = data.tasks || []
    console.log('TASKS STORED:', tasks.value)
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error)
  } finally {
    loading.value = false
  }
}

const viewTask = (taskId: string) => {
  router.push(`/app/task/${taskId}`)
}

const getStatusColor = (task: Task) => {
  switch (task.status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'info'
    case 'failed':
      return 'danger'
    case 'pending':
    default:
      return 'neutral'
  }
}

const getStatusText = (task: Task) => {
  switch (task.status) {
    case 'completed':
      return 'Terminée'
    case 'running':
      return 'En cours'
    case 'failed':
      return 'Échouée'
    case 'pending':
      return 'En attente'
    default:
      return 'Inconnu'
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Chargement initial
onMounted(() => {
  fetchTasks()
})

// Actualisation périodique optionnelle
const refreshInterval = setInterval(() => {
  fetchTasks()
}, 30000) // Toutes les 30 secondes

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>