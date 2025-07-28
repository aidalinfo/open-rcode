<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex items-center gap-4">
      <!-- Zone de recherche et filtres -->
      <div class="flex items-center gap-2 flex-1">
        <!-- Slot pour la recherche principale -->
        <slot name="search" />
        
        <!-- Slot pour les filtres -->
        <slot name="filters" />
      </div>

      <!-- Bouton refresh -->
      <UButton
        v-if="showRefresh"
        label="Rafraîchir"
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        @click="handleRefresh"
      />

      <!-- Sélecteur de colonnes -->
      <UDropdownMenu
        v-if="showColumnToggle"
        :items="columnToggleItems"
        :content="{ align: 'end' }"
      >
        <UButton
          label="Colonnes"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          class="ml-auto"
          aria-label="Menu de sélection des colonnes"
        />
      </UDropdownMenu>

      <slot name="toolbar-end" />
    </div>

    <!-- Table -->
    <UTable 
      ref="table" 
      :data="paginatedData" 
      :columns="visibleColumns" 
      :sticky="sticky" 
      :class="tableClass"
      @row-click="handleRowClick"
    >
      <!-- Slot pour les rows expandables -->
      <template v-if="$slots.expanded" #expanded="{ row }">
        <slot name="expanded" :row="row" />
      </template>

      <!-- Slots pour les colonnes personnalisées -->
      <slot />
    </UTable>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-500">
        {{ paginatedData.length }} sur {{ total || data.length }} élément(s) affiché(s).
      </div>

      <!-- Pagination -->
      <UPagination
        v-if="showPagination && pagination"
        :page="pagination.page"
        :items-per-page="pagination.limit"
        :total="total || data.length"
        @update:page="handlePageUpdate"
      />

      <slot name="footer-end" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { upperFirst } from 'lodash-es'

interface Column {
  id?: string
  accessorKey?: string
  header?: string
  [key: string]: any
}

interface Pagination {
  page: number
  limit: number
}

interface Props {
  data: any[]
  columns: Column[]
  total?: number
  pagination?: Pagination
  showPagination?: boolean
  showRefresh?: boolean
  showColumnToggle?: boolean
  sticky?: boolean
  tableClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  showPagination: true,
  showRefresh: true,
  showColumnToggle: true,
  sticky: true,
  tableClass: ''
})

const emit = defineEmits<{
  'update:page': [page: number]
  'refresh': []
  'row-click': [row: any]
}>()

const table = ref()
const hiddenColumns = ref<Set<string>>(new Set())

const visibleColumns = computed(() => {
  return props.columns.filter(column => {
    const key = column.accessorKey || column.id
    return key && !hiddenColumns.value.has(key)
  })
})

const paginatedData = computed(() => {
  if (!props.pagination || !props.showPagination) {
    return props.data
  }
  
  const start = (props.pagination.page - 1) * props.pagination.limit
  const end = start + props.pagination.limit
  
  return props.data.slice(start, end)
})

const columnToggleItems = computed(() => {
  return props.columns.map((column) => ({
    label: upperFirst(column.accessorKey || column.id || ''),
    type: 'checkbox' as const,
    checked: isColumnVisible(column.accessorKey || column.id || ''),
    onUpdateChecked() {
      toggleColumnVisibility(column.accessorKey || column.id || '')
    },
    onSelect(e?: Event) { 
      e?.preventDefault() 
    }
  }))
})

function isColumnVisible(columnKey: string): boolean {
  return !hiddenColumns.value.has(columnKey)
}

function toggleColumnVisibility(columnKey: string) {
  if (hiddenColumns.value.has(columnKey)) {
    hiddenColumns.value.delete(columnKey)
  } else {
    hiddenColumns.value.add(columnKey)
  }
}

function handleRefresh() {
  emit('refresh')
}

function handlePageUpdate(page: number) {
  emit('update:page', page)
}

function handleRowClick(row: any) {
  emit('row-click', row)
}
</script>