<template>
  <UCard class="mt-6">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Recent tasks
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
        No tasks have been executed yet.
      </p>
    </div>

    <CustomTable
      v-else
      :data="tasks"
      :columns="columns"
      :pagination="pagination"
      :total="total"
      show-refresh
      show-pagination
      :show-column-toggle="false"
      @refresh="fetchTasks"
      @update:page="handlePageUpdate"
    />
  </UCard>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '#ui/types'
import type { Row } from '@tanstack/vue-table'

const router = useRouter()
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

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

// Reactive states
const tasks = ref<Task[]>([])
const loading = ref(false)
const total = ref(0)
const pagination = ref({
  page: 1,
  limit: 10
})

// Table configuration
const columns = computed((): TableColumn<Task>[] => [
  {
    id: 'actions',
    header: '',
    cell: ({ row }: { row: Row<Task> }) => {
      return h(UButton, {
        size: 'xs',
        variant: 'ghost',
        icon: 'i-lucide-eye',
        onClick: () => viewTask(row.original._id)
      })
    }
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Task',
    cell: ({ row }: { row: Row<Task> }) => {
      return h('div', { class: 'font-medium text-gray-900 dark:text-white truncate max-w-xs' }, 
        row.original.name
      )
    }
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: Row<Task> }) => {
      return h(UBadge, {
        color: getStatusColor(row.original),
        variant: row.original.status === 'completed' || row.original.status === 'failed' ? 'solid' : 'soft',
        size: 'xs'
      }, () => getStatusText(row.original))
    }
  },
  {
    id: 'environment',
    header: 'Environment',
    cell: ({ row }: { row: Row<Task> }) => {
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs' }, 
        row.original.environment?.name || 'N/A'
      )
    }
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created on',
    cell: ({ row }: { row: Row<Task> }) => {
      return h('div', { class: 'text-sm text-gray-600 dark:text-gray-400' }, 
        formatDate(row.original.createdAt)
      )
    }
  },
  {
    id: 'pr',
    header: 'Pull Request',
    cell: ({ row }: { row: Row<Task> }) => {
      if (row.original.pr) {
        return h(UButton, {
          to: row.original.pr.url,
          target: '_blank',
          size: 'xs',
          variant: 'ghost',
          icon: 'i-heroicons-arrow-top-right-on-square'
        }, () => `PR #${row.original.pr.number}`)
      }
      return h('div', { class: 'text-sm text-gray-400' }, '-')
    }
  }
])

// Methods
const fetchTasks = async () => {
  loading.value = true
  try {
    console.log('FETCHING TASKS...')
    const data = await $fetch('/api/tasks', {
      query: {
        page: pagination.value.page,
        limit: pagination.value.limit
      }
    })
    console.log('TASKS DATA RECEIVED:', data)
    tasks.value = data.tasks || []
    total.value = data.total || 0
    console.log('TASKS STORED:', tasks.value)
  } catch (error) {
    console.error('Error fetching tasks:', error)
  } finally {
    loading.value = false
  }
}

const handlePageUpdate = (page: number) => {
  pagination.value.page = page
  fetchTasks()
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
      return 'Completed'
    case 'running':
      return 'Running'
    case 'failed':
      return 'Failed'
    case 'pending':
      return 'Pending'
    default:
      return 'Unknown'
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Initial loading
onMounted(() => {
  fetchTasks()
})

// Optional periodic refresh
const refreshInterval = setInterval(() => {
  fetchTasks()
}, 30000) // Every 30 seconds

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>