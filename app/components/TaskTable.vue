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
      :rows="tasks"
      :columns="columns"
      :loading="loading"
      class="w-full"
    >
      <template #name-data="{ row }">
        <div class="font-medium text-gray-900 dark:text-white truncate max-w-xs">
          {{ row.name }}
        </div>
      </template>

      <template #status-data="{ row }">
        <UBadge
          :color="getStatusColor(row)"
          :variant="row.executed ? 'solid' : 'soft'"
          size="xs"
        >
          {{ getStatusText(row) }}
        </UBadge>
      </template>

      <template #environment-data="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
          {{ row.environment?.name || 'N/A' }}
        </div>
      </template>

      <template #createdAt-data="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ formatDate(row.createdAt) }}
        </div>
      </template>

      <template #pr-data="{ row }">
        <div v-if="row.pr">
          <UButton
            :to="row.pr.url"
            target="_blank"
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-top-right-on-square"
          >
            PR #{{ row.pr.number }}
          </UButton>
        </div>
        <div v-else class="text-sm text-gray-400">
          -
        </div>
      </template>

      <template #actions-data="{ row }">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-heroicons-chat-bubble-left-ellipsis"
          @click="viewTask(row._id)"
          :disabled="!row.executed"
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
}

// États réactifs
const tasks = ref<Task[]>([])
const loading = ref(false)

// Configuration du tableau
const columns = [
  {
    key: 'name',
    label: 'Tâche',
    sortable: false
  },
  {
    key: 'status',
    label: 'Statut',
    sortable: false
  },
  {
    key: 'environment',
    label: 'Environnement',
    sortable: false
  },
  {
    key: 'createdAt',
    label: 'Créée le',
    sortable: false
  },
  {
    key: 'pr',
    label: 'Pull Request',
    sortable: false
  },
  {
    key: 'actions',
    label: 'Actions',
    sortable: false
  }
]

// Méthodes
const fetchTasks = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/tasks')
    tasks.value = data.tasks || []
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
  if (task.merged) return 'green'
  if (task.executed) return 'blue'
  return 'gray'
}

const getStatusText = (task: Task) => {
  if (task.merged) return 'Fusionnée'
  if (task.executed) return 'Exécutée'
  return 'En cours'
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