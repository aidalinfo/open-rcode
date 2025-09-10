<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">MCP Servers</h2>
        <UButton to="/app/settings/mcp/create" icon="i-lucide-plus" size="sm">New MCP</UButton>
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-refresh-cw" class="w-6 h-6 animate-spin text-primary-500" />
    </div>

    <div v-else-if="mcps.length === 0" class="text-center py-8">
      <UIcon name="i-lucide-cpu" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No MCP servers</h3>
      <p class="text-gray-600 dark:text-gray-400">Create your first MCP server entry.</p>
    </div>

    <CustomTable
      v-else
      :data="mcps"
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
import type { TableColumn } from '#ui/types'
import type { Row } from '@tanstack/vue-table'

interface Mcp {
  _id: string
  userId: string
  name: string
  type: 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  description?: string
  createdAt: string
  updatedAt: string
}

const toast = useToast()

const props = defineProps<{ mcps: Mcp[]; loading?: boolean; total?: number; page?: number; limit?: number }>()
const emit = defineEmits<{ 'refresh': []; 'update:page': [page: number] }>()

const pagination = ref({ page: props.page || 1, limit: props.limit || 10 })
watch(() => props.page, p => { if (p) pagination.value.page = p })
watch(() => props.limit, l => { if (l) pagination.value.limit = l })

const handleRefresh = () => emit('refresh')
const handlePageUpdate = (page: number) => { pagination.value.page = page; emit('update:page', page) }

const columns = computed((): TableColumn<Mcp>[] => [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'type', header: 'Type', cell: ({ row }: { row: Row<Mcp> }) => row.original.type.toUpperCase() },
  { accessorKey: 'endpoint', header: 'Endpoint', cell: ({ row }: { row: Row<Mcp> }) => row.original.type === 'sse' ? (row.original.url || '-') : (row.original.command || '-') },
  { accessorKey: 'createdAt', header: 'Created on', cell: ({ row }: { row: Row<Mcp> }) => formatDate(row.original.createdAt) },
  {
    id: 'actions', header: 'Actions', cell: ({ row }: { row: Row<Mcp> }) => h('div', { class: 'flex items-center gap-2' }, [
      h(UButton, { to: `/app/settings/mcp/update?edit=${row.original._id}`, variant: 'ghost', size: 'xs', icon: 'i-lucide-pencil' }, () => 'Edit'),
      h(UButton, { onClick: () => deleteMcp(row.original._id), color: 'error', variant: 'ghost', size: 'xs', icon: 'i-lucide-trash-2' }, () => 'Delete')
    ])
  }
])

const deleteMcp = async (id: string) => {
  if (!confirm('Delete this MCP entry?')) return
  try {
    await $fetch(`/api/mcp/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Deleted', description: 'MCP deleted', color: 'success' })
    emit('refresh')
  } catch (e) {
    toast.add({ title: 'Error', description: 'Unable to delete MCP', color: 'error' })
  }
}

const formatDate = (dateString: string) => new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateString))
</script>
