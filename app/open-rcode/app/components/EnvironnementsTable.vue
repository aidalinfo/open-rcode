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

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
    </div>

    <div v-else-if="environments.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
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
    />
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
  runtime: 'node' | 'php' | 'python'
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli'
  defaultBranch: string
  environmentVariables: Array<{ key: string; value: string; description?: string }>
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
  refresh: []
  delete: [id: string]
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
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}
</script>