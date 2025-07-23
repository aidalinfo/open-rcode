<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          Environnements
        </h2>
        <UButton
          to="/app/settings/environnement/create"
          icon="i-heroicons-plus"
          size="sm"
        >
          Nouvel environnement
        </UButton>
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
    </div>

    <div v-else-if="environments.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Aucun environnement
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Créez votre premier environnement pour commencer.
      </p>
    </div>

    <UTable
      v-else
      :data="environments"
      :columns="columns"
      :loading="loading"
      class="w-full"
    >
      <template #name-cell="{ row }">
        <div class="flex items-center gap-3">
          <div class="font-medium text-gray-900 dark:text-white">
            {{ row.original.name }}
          </div>
          <UBadge :color="getRuntimeColor(row.original.runtime)" size="xs">
            {{ row.original.runtime }}
          </UBadge>
        </div>
      </template>

      <template #repository-cell="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
          {{ row.original.repositoryFullName }}
        </div>
      </template>

      <template #defaultBranch-cell="{ row }">
        <UBadge variant="soft" size="xs" color="neutral">
          {{ row.original.defaultBranch || 'main' }}
        </UBadge>
      </template>

      <template #aiProvider-cell="{ row }">
        <div class="flex items-center gap-2">
          <UIcon 
            :name="getAiProviderIcon(row.original.aiProvider)" 
            :class="getAiProviderColor(row.original.aiProvider)"
            class="w-4 h-4"
          />
          <span class="text-sm">{{ getAiProviderLabel(row.original.aiProvider) }}</span>
        </div>
      </template>

      <template #variables-cell="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ row.original.environmentVariables?.length || 0 }} variable{{ (row.original.environmentVariables?.length || 0) > 1 ? 's' : '' }}
        </div>
      </template>

      <template #createdAt-cell="{ row }">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ formatDate(row.original.createdAt) }}
        </div>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center gap-2">
          <UButton
            :to="`/app/settings/environnement/update?edit=${row.original.id}`"
            variant="ghost"
            size="xs"
            icon="i-heroicons-pencil-square"
          >
            Modifier
          </UButton>
          <UButton
            @click="deleteEnvironment(row.original.id)"
            color="error"
            variant="ghost"
            size="xs"
            icon="i-heroicons-trash"
          >
            Supprimer
          </UButton>
        </div>
      </template>
    </UTable>
  </UCard>
</template>

<script setup lang="ts">
const toast = useToast()

interface Environment {
  id: string
  name: string
  description?: string
  repositoryFullName: string
  runtime: 'node' | 'php' | 'python'
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli'
  defaultBranch: string
  environmentVariables: Array<{ key: string; value: string; description?: string }>
  createdAt: string
  updatedAt: string
}

// Props
defineProps<{
  environments: Environment[]
  loading: boolean
}>()

// Emits
const emit = defineEmits<{
  refresh: []
  delete: [id: string]
}>()

// Configuration du tableau
const columns = [
  {
    id: 'name',
    header: 'Nom'
  },
  {
    id: 'repository',
    header: 'Repository'
  },
  {
    id: 'defaultBranch',
    header: 'Branche'
  },
  {
    id: 'aiProvider',
    header: 'Provider IA'
  },
  {
    id: 'variables',
    header: 'Variables'
  },
  {
    id: 'createdAt',
    header: 'Créé le'
  },
  {
    id: 'actions',
    header: 'Actions'
  }
]

// Méthodes
const deleteEnvironment = async (id: string) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cet environnement ?')) {
    try {
      await $fetch(`/api/environments/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Succès',
        description: 'Environnement supprimé avec succès',
        color: 'success'
      })
      emit('refresh')
    } catch (error) {
      toast.add({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'environnement',
        color: 'error'
      })
    }
  }
}

const getRuntimeColor = (runtime: string) => {
  switch (runtime) {
    case 'node': return 'success'
    case 'php': return 'info'
    case 'python': return 'warning'
    default: return 'secondary'
  }
}

const getAiProviderIcon = (provider: string) => {
  switch (provider) {
    case 'anthropic-api': return 'i-heroicons-cpu-chip'
    case 'claude-oauth': return 'i-heroicons-identification'
    case 'gemini-cli': return 'i-heroicons-sparkles'
    default: return 'i-heroicons-cog-6-tooth'
  }
}

const getAiProviderColor = (provider: string) => {
  switch (provider) {
    case 'anthropic-api': return 'text-purple-500'
    case 'claude-oauth': return 'text-blue-500'
    case 'gemini-cli': return 'text-amber-500'
    default: return 'text-gray-500'
  }
}

const getAiProviderLabel = (provider: string) => {
  switch (provider) {
    case 'anthropic-api': return 'Anthropic API'
    case 'claude-oauth': return 'Claude OAuth'
    case 'gemini-cli': return 'Gemini CLI'
    default: return provider
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}
</script>