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

      <!-- Bouton de basculement vue table/cartes -->
      <UButton
        :icon="viewMode === 'table' ? 'i-lucide-layout-grid' : 'i-lucide-layout-list'"
        :label="viewMode === 'table' ? 'Vue cartes' : 'Vue table'"
        color="neutral"
        variant="outline"
        @click="toggleViewMode"
      />

      <!-- Sélecteur de colonnes -->
      <UDropdownMenu
        v-if="showColumnToggle && viewMode === 'table'"
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

    <!-- Vue Table -->
    <UTable 
      v-if="viewMode === 'table'"
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

    <!-- Vue Cartes -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <UCard
        v-for="(item, index) in paginatedData"
        :key="index"
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="handleRowClick(item)"
      >
        <!-- Slot personnalisé pour le contenu de la carte -->
        <slot v-if="$slots['card-template']" name="card-template" :item="item" :columns="visibleColumns" />
        
        <!-- Template par défaut -->
        <template v-else>
          <!-- Header de la carte (première colonne visible) -->
          <template v-if="visibleColumns.length > 0" #header>
            <h3 class="text-lg font-semibold truncate">
              {{ getItemValue(item, visibleColumns[0]) }}
            </h3>
          </template>

          <!-- Contenu de la carte -->
          <div class="space-y-2">
            <div
              v-for="(column, colIndex) in visibleColumns.slice(1)"
              :key="colIndex"
              class="flex items-start gap-2"
            >
              <span class="text-sm text-gray-500 font-medium min-w-[120px]">
                {{ column.header || column.id || column.accessorKey }}:
              </span>
              <span class="text-sm flex-1">
                <slot 
                  v-if="$slots[column.id || column.accessorKey || '']" 
                  :name="column.id || column.accessorKey || ''"
                  :row="item"
                />
                <span v-else>
                  {{ getItemValue(item, column) }}
                </span>
              </span>
            </div>
          </div>

          <!-- Footer avec actions si nécessaire -->
          <template v-if="$slots['card-actions']" #footer>
            <slot name="card-actions" :item="item" />
          </template>
        </template>
      </UCard>
    </div>

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
import { upperFirst, get } from 'lodash-es'

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
  defaultViewMode?: 'table' | 'card'
}

const props = withDefaults(defineProps<Props>(), {
  showPagination: true,
  showRefresh: true,
  showColumnToggle: true,
  sticky: true,
  tableClass: '',
  defaultViewMode: 'table'
})

const emit = defineEmits<{
  'update:page': [page: number]
  'refresh': []
  'row-click': [row: any]
}>()

const table = ref()
const hiddenColumns = ref<Set<string>>(new Set())
const viewMode = ref<'table' | 'card'>(props.defaultViewMode)

const visibleColumns = computed(() => {
  return props.columns.filter(column => {
    const key = column.id || column.accessorKey
    return key && !hiddenColumns.value.has(key)
  })
})

const paginatedData = computed(() => {
  // Si on a un total défini, cela signifie qu'on utilise la pagination côté serveur
  // Dans ce cas, ne pas faire de pagination côté client
  if (props.total) {
    return props.data
  }
  
  // Sinon, faire la pagination côté client (comportement original)
  if (!props.pagination || !props.showPagination) {
    return props.data
  }
  
  const start = (props.pagination.page - 1) * props.pagination.limit
  const end = start + props.pagination.limit
  
  return props.data.slice(start, end)
})

const columnToggleItems = computed(() => {
  return props.columns.map((column) => ({
    label: upperFirst(column.header || column.id || column.accessorKey || ''),
    type: 'checkbox' as const,
    checked: isColumnVisible(column.id || column.accessorKey || ''),
    onUpdateChecked() {
      toggleColumnVisibility(column.id || column.accessorKey || '')
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

function toggleViewMode() {
  viewMode.value = viewMode.value === 'table' ? 'card' : 'table'
}

function getItemValue(item: any, column: Column): any {
  const key = column.accessorKey || column.id
  if (!key) return ''
  
  // Support des chemins imbriqués (ex: 'user.name')
  return get(item, key, '')
}
</script>