<template>
  <UCard class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
    <div class="space-y-3">
      <!-- Header avec statut et date -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <UBadge 
            :color="statusColor"
            :variant="statusVariant"
            size="sm"
          >
            <UIcon :name="statusIcon" class="w-3 h-3 mr-1" />
            {{ statusText }}
          </UBadge>
          <span v-if="task.planMode" class="text-xs text-blue-600 dark:text-blue-400">
            <UIcon name="i-heroicons-light-bulb" class="w-3 h-3 mr-1" />
            Plan Mode
          </span>
        </div>
        <time class="text-xs text-gray-500 dark:text-gray-400">
          {{ formatDate(task.createdAt) }}
        </time>
      </div>

      <!-- Nom de la tâche -->
      <h3 class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
        {{ task.name }}
      </h3>

      <!-- Informations environnement et dernière mise à jour -->
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div v-if="task.environment" class="flex items-center space-x-1">
          <UIcon name="i-heroicons-cube" class="w-3 h-3" />
          <span>{{ task.environment.name }}</span>
        </div>
        <div class="flex items-center space-x-1">
          <UIcon name="i-heroicons-clock" class="w-3 h-3" />
          <span>Last update {{ formatDate(task.updatedAt) }}</span>
        </div>
      </div>

      <!-- PR Link si disponible -->
      <div v-if="task.pr" class="flex items-center space-x-2">
        <UIcon name="i-simple-icons-github" class="w-4 h-4 text-gray-500" />
        <ULink 
          :to="task.pr.url" 
          target="_blank"
          class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate"
          @click.stop
        >
          Pull Request #{{ task.pr.number }}
          <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3 ml-1" />
        </ULink>
        <UBadge v-if="task.merged" color="success" variant="soft" size="sm">
          Merged
        </UBadge>
      </div>

      <!-- Erreur si présente -->
      <div v-if="task.error" class="flex items-start space-x-2">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p class="text-xs text-red-600 dark:text-red-400 line-clamp-2">
          {{ task.error }}
        </p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { TaskCard } from '~/shared/types/task'

interface Props {
  task: TaskCard
}

const props = defineProps<Props>()

// Computed properties pour le statut
const statusColor = computed(() => {
  switch (props.task.status) {
    case 'pending': return 'neutral'
    case 'running': return 'primary'
    case 'completed': return 'success'
    case 'failed': return 'error'
    default: return 'neutral'
  }
})

const statusVariant = computed(() => {
  return props.task.status === 'running' ? 'solid' : 'soft'
})

const statusIcon = computed(() => {
  switch (props.task.status) {
    case 'pending': return 'i-heroicons-clock'
    case 'running': return 'i-heroicons-play'
    case 'completed': return 'i-heroicons-check-circle'
    case 'failed': return 'i-heroicons-x-circle'
    default: return 'i-heroicons-question-mark-circle'
  }
})

const statusText = computed(() => {
  switch (props.task.status) {
    case 'pending': return 'Pending'
    case 'running': return 'Running'
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    default: return 'Unknown'
  }
})

// Formatage de la date
const formatDate = (date: string | Date) => {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 7) {
    return d.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    })
  } else if (diffDays > 0) {
    return `${diffDays}j`
  } else if (diffHours > 0) {
    return `${diffHours}h`
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return diffMinutes > 0 ? `${diffMinutes}min` : 'Maintenant'
  }
}
</script>