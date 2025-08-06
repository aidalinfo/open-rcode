<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          SubAgents
        </h2>
        <UButton
          to="/app/settings/subagent/create"
          icon="i-heroicons-plus"
          size="sm"
        >
          New SubAgent
        </UButton>
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
    </div>

    <div v-else-if="subagents.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-cpu-chip" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No SubAgents
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Create your first SubAgent to get started.
      </p>
    </div>

    <CustomTable
      v-else
      :data="subagents"
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
          <!-- En-tête avec nom et badge -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <h4 class="font-medium text-gray-900 dark:text-white">
                {{ item.name }}
              </h4>
              <p v-if="item.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {{ item.description }}
              </p>
            </div>
            <UBadge
              :color="item.isPublic ? 'success' : 'neutral'"
              size="xs"
            >
              {{ item.isPublic ? 'Public' : 'Private' }}
            </UBadge>
          </div>

          <!-- Prompt preview -->
          <div class="bg-gray-50 dark:bg-gray-800 rounded-md p-3">
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {{ item.prompt }}
            </p>
          </div>

          <!-- Informations -->
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm">
              <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-400">
                Created: {{ formatDate(item.createdAt) }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <UIcon name="i-lucide-user" class="w-4 h-4 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-400">
                By: {{ item.userId }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <UButton
              :to="`/app/settings/subagent/update?edit=${item._id}`"
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
              @click="deleteSubAgent(item._id)"
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

interface SubAgent {
  _id: string
  name: string
  description?: string
  prompt: string
  isPublic: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

// Props
const props = defineProps<{
  subagents: SubAgent[]
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
const columns = computed((): TableColumn<SubAgent>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<SubAgent> }) => {
      return h('div', { class: 'font-medium text-gray-900 dark:text-white' }, row.original.name)
    }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }: { row: Row<SubAgent> }) => {
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400 max-w-md truncate' }, 
        row.original.description || 'No description'
      )
    }
  },
  {
    accessorKey: 'isPublic',
    header: 'Visibility',
    cell: ({ row }: { row: Row<SubAgent> }) => {
      return h(UBadge, {
        color: row.original.isPublic ? 'success' : 'neutral',
        size: 'xs'
      }, () => row.original.isPublic ? 'Public' : 'Private')
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created on',
    cell: ({ row }: { row: Row<SubAgent> }) => {
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400' }, 
        formatDate(row.original.createdAt)
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: Row<SubAgent> }) => {
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UButton, {
          to: `/app/settings/subagent/update?edit=${row.original._id}`,
          variant: 'ghost',
          size: 'xs',
          icon: 'i-heroicons-pencil-square'
        }, () => 'Edit'),
        h(UButton, {
          onClick: () => deleteSubAgent(row.original._id),
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
const deleteSubAgent = async (id: string) => {
  if (confirm('Are you sure you want to delete this SubAgent?')) {
    try {
      await $fetch(`/api/sub-agents/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Success',
        description: 'SubAgent deleted successfully',
        color: 'success'
      })
      emit('refresh')
    } catch (error) {
      toast.add({
        title: 'Error',
        description: 'Unable to delete SubAgent',
        color: 'error'
      })
    }
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