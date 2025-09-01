<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          Environments
        </h2>
        <UButton
          to="/app/settings/environnement/create"
          icon="i-heroicons-plus"
          size="sm"
        >
          New environment
        </UButton>
      </div>
    </template>

    <div
      v-if="loading"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-heroicons-arrow-path"
        class="w-6 h-6 animate-spin text-primary-500"
      />
    </div>

    <div
      v-else-if="environments.length === 0"
      class="text-center py-8"
    >
      <UIcon
        name="i-heroicons-cube"
        class="w-12 h-12 mx-auto text-gray-400 mb-4"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No environments
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Create your first environment to get started.
      </p>
    </div>

    <CustomTable
      v-else
      :data="environments"
      :columns="columns"
      :pagination="pagination"
      :total="total"
      show-refresh
      show-pagination
      :show-column-toggle="false"
      @refresh="handleRefresh"
      @update:page="handlePageUpdate"
    >
      <!-- Template personnalisé pour les cartes -->
      <template #card-template="{ item }">
        <div class="space-y-4">
          <!-- En-tête avec nom et runtime -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <h4 class="font-medium text-gray-900 dark:text-white">
                {{ item.name }}
              </h4>
              <p
                v-if="item.description"
                class="text-sm text-gray-600 dark:text-gray-400 mt-1"
              >
                {{ item.description }}
              </p>
            </div>
            <UBadge
              :color="getRuntimeColor(item.runtime)"
              size="xs"
            >
              {{ item.runtime }}
            </UBadge>
          </div>

          <!-- Informations -->
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm">
              <UIcon
                name="i-lucide-git-branch"
                class="w-4 h-4 text-gray-400"
              />
              <span class="text-gray-600 dark:text-gray-400">
                {{ item.repositoryFullName }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <UIcon
                name="i-lucide-git-commit"
                class="w-4 h-4 text-gray-400"
              />
              <UBadge
                variant="soft"
                size="xs"
                color="neutral"
              >
                {{ item.defaultBranch || 'main' }}
              </UBadge>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <UIcon
                :name="getAiProviderIcon(item.aiProvider)"
                :class="`w-4 h-4 ${getAiProviderColor(item.aiProvider)}`"
              />
              <span class="text-gray-600 dark:text-gray-400">
                {{ getAiProviderLabel(item.aiProvider) }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <UIcon
                name="i-lucide-variable"
                class="w-4 h-4 text-gray-400"
              />
              <span class="text-gray-600 dark:text-gray-400">
                {{ item.environmentVariables?.length || 0 }} variable{{ (item.environmentVariables?.length || 0) > 1 ? 's' : '' }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <UIcon
                name="i-lucide-calendar"
                class="w-4 h-4 text-gray-400"
              />
              <span class="text-gray-600 dark:text-gray-400">
                {{ formatDate(item.createdAt) }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <UButton
              :to="`/app/settings/environnement/update?edit=${item.id}`"
              variant="soft"
              size="sm"
              icon="i-lucide-pencil"
              class="flex-1"
            >
              Edit
            </UButton>
            <UButton
              color="red"
              variant="soft"
              size="sm"
              icon="i-lucide-trash"
              @click="deleteEnvironment(item.id)"
            >
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </CustomTable>
  </UCard>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '#ui/types'
import type { Row } from '@tanstack/vue-table'

const toast = useToast()
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UIcon = resolveComponent('UIcon')

interface Environment {
  id: string
  name: string
  description?: string
  repositoryFullName: string
  runtime: 'node' | 'python' | 'bun' | 'java' | 'swift' | 'ruby' | 'rust' | 'go' | 'php'
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli'
  defaultBranch: string
  environmentVariables: Array<{ key: string, value: string, description?: string }>
  createdAt: string
  updatedAt: string
}

// Props
const props = defineProps<{
  environments: Environment[]
  loading: boolean
  total?: number
  page?: number
  limit?: number
}>()

// Emits
const emit = defineEmits<{
  'refresh': []
  'delete': [id: string]
  'update:page': [page: number]
}>()

// Reactive state
const pagination = ref({
  page: props.page || 1,
  limit: props.limit || 10
})

// Watch for prop changes
watch(() => props.page, (newPage) => {
  if (newPage) pagination.value.page = newPage
})

watch(() => props.limit, (newLimit) => {
  if (newLimit) pagination.value.limit = newLimit
})

// Methods
const handleRefresh = () => {
  emit('refresh')
}

const handlePageUpdate = (page: number) => {
  pagination.value.page = page
  emit('update:page', page)
}

// Table configuration
const columns = computed((): TableColumn<Environment>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<Environment> }) => {
      return h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: 'font-medium text-gray-900 dark:text-white' }, row.original.name),
        h(UBadge, {
          color: getRuntimeColor(row.original.runtime),
          size: 'xs'
        }, () => row.original.runtime)
      ])
    }
  },
  {
    accessorKey: 'repositoryFullName',
    header: 'Repository',
    cell: ({ row }: { row: Row<Environment> }) => {
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs' },
        row.original.repositoryFullName
      )
    }
  },
  {
    accessorKey: 'defaultBranch',
    header: 'Branch',
    cell: ({ row }: { row: Row<Environment> }) => {
      return h(UBadge, {
        variant: 'soft',
        size: 'xs',
        color: 'neutral'
      }, () => row.original.defaultBranch || 'main')
    }
  },
  {
    accessorKey: 'aiProvider',
    header: 'AI Provider',
    cell: ({ row }: { row: Row<Environment> }) => {
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UIcon, {
          name: getAiProviderIcon(row.original.aiProvider),
          class: `w-4 h-4 ${getAiProviderColor(row.original.aiProvider)}`
        }),
        h('span', { class: 'text-sm' }, getAiProviderLabel(row.original.aiProvider))
      ])
    }
  },
  {
    id: 'variables',
    header: 'Variables',
    cell: ({ row }: { row: Row<Environment> }) => {
      const count = row.original.environmentVariables?.length || 0
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400' },
        `${count} variable${count > 1 ? 's' : ''}`
      )
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created on',
    cell: ({ row }: { row: Row<Environment> }) => {
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400' },
        formatDate(row.original.createdAt)
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: Row<Environment> }) => {
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UButton, {
          to: `/app/settings/environnement/update?edit=${row.original.id}`,
          variant: 'ghost',
          size: 'xs',
          icon: 'i-heroicons-pencil-square'
        }, () => 'Edit'),
        h(UButton, {
          onClick: () => deleteEnvironment(row.original.id),
          color: 'error',
          variant: 'ghost',
          size: 'xs',
          icon: 'i-heroicons-trash'
        }, () => 'Delete')
      ])
    }
  }
])

// Methods
const deleteEnvironment = async (id: string) => {
  if (confirm('Are you sure you want to delete this environment?')) {
    try {
      await $fetch(`/api/environments/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Success',
        description: 'Environment deleted successfully',
        color: 'success'
      })
      emit('refresh')
    } catch (error) {
      toast.add({
        title: 'Error',
        description: 'Unable to delete environment',
        color: 'error'
      })
    }
  }
}

const getRuntimeColor = (runtime: string) => {
  switch (runtime) {
    case 'node': return 'success'
    case 'python': return 'warning'
    case 'bun': return 'indigo'
    case 'java': return 'danger'
    case 'swift': return 'orange'
    case 'ruby': return 'red'
    case 'rust': return 'amber'
    case 'go': return 'sky'
    case 'php': return 'info'
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
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}
</script>
