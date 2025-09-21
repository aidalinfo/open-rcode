<template>
  <div class="relative">
    <UChatPrompt
      ref="chatPromptRef"
      v-model="localInput"
      :status="loading ? 'streaming' : 'ready'"
      placeholder="Ask your question... (use @ to reference files)"
      @submit="handleSubmit"
      @keydown="handleKeydown"
      @input="handleInput"
    >
      <UChatPromptSubmit />

      <template #footer>
        <div class="w-full flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div class="w-full sm:w-auto sm:max-w-md min-w-0">
            <USelectMenu
              v-model="localSelectedEnvironment"
              v-model:search-term="envSearchTerm"
              :items="environmentItems"
              :loading="loadingEnvironments && environmentItems.length === 0"
              label-key="label"
              value-key="value"
              icon="i-heroicons-cube"
              placeholder="Select an environment"
              variant="ghost"
              class="w-full min-w-0"
              :ui="{ base: 'w-full min-w-0', value: 'truncate', placeholder: 'truncate text-gray-500 dark:text-gray-400' }"
              ignore-filter
              @update:open="onEnvMenuOpen"
              @update:model-value="onEnvironmentSelected"
            >
              <template #content-bottom>
                <div class="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div class="text-xs text-gray-500">
                    Page {{ envPage }} • {{ environmentItems.length }} / {{ envTotal }}
                  </div>
                  <UButton
                    size="xs"
                    :disabled="loadingEnvironments || !hasMoreEnvs"
                    :loading="loadingEnvironments"
                    @click="loadMoreEnvironments"
                  >
                    Load more
                  </UButton>
                </div>
              </template>
            </USelectMenu>
          </div>

          <!-- Reasoning select shown only for Codex providers -->
          <div
            v-if="isCodexSelectedEnv"
            class="w-full sm:w-auto sm:max-w-xs min-w-0"
          >
            <USelect
              v-model="localReasoningEffort"
              :items="reasoningOptions"
              icon="i-heroicons-sparkles"
              placeholder="Reasoning"
              variant="ghost"
              class="w-full min-w-0"
              :ui="{ base: 'w-full min-w-0', value: 'truncate', placeholder: 'truncate text-gray-500 dark:text-gray-400' }"
            />
          </div>

          <div
            v-if="showMcpSelector"
            class="w-full sm:w-auto sm:max-w-md min-w-0"
          >
            <USelectMenu
              v-model="selectedMcpIds"
              v-model:search-term="mcpSearchTerm"
              :items="mcpItems"
              :loading="loadingMcps && mcpItems.length === 0"
              label-key="label"
              value-key="value"
              icon="i-heroicons-server-stack"
              placeholder="Select MCP servers"
              variant="ghost"
              multiple
              class="w-full min-w-0"
              :ui="{ base: 'w-full min-w-0', value: 'truncate', placeholder: 'truncate text-gray-500 dark:text-gray-400' }"
              ignore-filter
              @update:open="onMcpMenuOpen"
            >
              <template #content-bottom>
                <div class="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div class="text-xs text-gray-500">
                    Page {{ mcpPage }} • {{ mcpLoadedCount }} / {{ mcpTotal }}
                  </div>
                  <UButton
                    size="xs"
                    :disabled="loadingMcps || !hasMoreMcps"
                    :loading="loadingMcps"
                    @click="loadMoreMcps"
                  >
                    Load more
                  </UButton>
                </div>
              </template>
            </USelectMenu>
          </div>
        </div>
      </template>
    </UChatPrompt>

    <!-- File Path Autocomplete -->
    <div
      v-if="showFileMenu && filteredFilePaths.length > 0"
      class="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-80"
      :style="menuPosition"
    >
      <div class="p-2">
        <div class="text-xs text-gray-500 mb-2">
          Select a file path:
        </div>
        <div class="space-y-1">
          <button
            v-for="item in filteredFilePaths"
            :key="item.value"
            class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            @click="insertFilePath(item.value)"
          >
            <div class="font-medium">
              {{ item.label }}
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

interface Props {
  input: string
  selectedEnvironment: string
  environments: any[]
  loading: boolean
}

interface Emits {
  (e: 'update:input', value: string): void
  (e: 'update:selectedEnvironment', value: string): void
  (e: 'submit', data: { message: string, environmentId: string, task?: any, planMode?: boolean, autoMerge?: boolean, selectedMcpIds?: string[] }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toast = useToast()

// File path autocomplete state
const showFileMenu = ref(false)
const selectedFilePath = ref('')
const menuPosition = ref({ top: '0px', left: '0px' })
const cursorPosition = ref(0)
const atPosition = ref(-1)
const filePaths = ref<string[]>([])
const chatPromptRef = ref()

// Computed properties for two-way binding
const localInput = computed({
  get: () => props.input,
  set: value => emit('update:input', value)
})

const normalizeEnvironmentValue = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const maybeValue = (value as Record<string, unknown>).value
    if (typeof maybeValue === 'string') return maybeValue
  }
  return ''
}

const localSelectedEnvironment = computed({
  get: () => props.selectedEnvironment,
  set: value => emit('update:selectedEnvironment', normalizeEnvironmentValue(value))
})

// Remote environments for USelectMenu (search + pagination)
const environmentItems = ref<Array<{ label: string, value: string }>>([])
const loadingEnvironments = ref(false)
const envSearchTerm = ref('')
const envSearchTermDebounced = refDebounced(envSearchTerm, 250)
const envPage = ref(1)
const envLimit = ref(10)
const envTotal = ref(0)
const hasMoreEnvs = computed(() => environmentItems.value.length < envTotal.value)

// Remote MCP servers for OpenAI environments (search + pagination)
const selectedMcpIds = ref<string[]>([])
const mcpItems = ref<Array<{ label: string, value: string }>>([])
const loadingMcps = ref(false)
const mcpSearchTerm = ref('')
const mcpSearchTermDebounced = refDebounced(mcpSearchTerm, 250)
const mcpPage = ref(1)
const mcpLimit = ref(10)
const mcpTotal = ref(0)
const mcpFetchedOnce = ref(false)
const mcpOptionCache = ref<Record<string, { label: string, value: string }>>({})
const hasMoreMcps = computed(() => (mcpPage.value * mcpLimit.value) < mcpTotal.value)
const mcpLoadedCount = computed(() => {
  if (mcpTotal.value === 0) return mcpItems.value.length
  return Math.min(mcpItems.value.length, mcpTotal.value)
})
const mcpKnownTotal = ref(0)

const fetchEnvironments = async (opts?: { reset?: boolean }) => {
  const reset = !!opts?.reset
  if (reset) {
    envPage.value = 1
    environmentItems.value = []
  }
  loadingEnvironments.value = true
  try {
    const data = await $fetch('/api/environments', {
      params: {
        q: envSearchTermDebounced.value || undefined,
        page: envPage.value,
        limit: envLimit.value
      }
    })
    envTotal.value = data.total || 0
    const mapped = (data.environments || []).map((env: any) => ({
      label: `${env.name} (${env.repositoryFullName})`,
      value: env.id
    }))
    if (reset) {
      environmentItems.value = mapped
    } else {
      environmentItems.value = [...environmentItems.value, ...mapped]
    }
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching environments:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to load environments',
      color: 'error'
    })
  } finally {
    loadingEnvironments.value = false
  }
}

// Seed the menu with environments already provided by parent (initial load)
watch(
  () => props.environments,
  (initialEnvs) => {
    if (!initialEnvs?.length || environmentItems.value.length) return
    environmentItems.value = initialEnvs.map((env: any) => ({
      label: `${env.name} (${env.repositoryFullName})`,
      value: env.id
    }))
  },
  { immediate: true }
)

const onEnvMenuOpen = (open: boolean) => {
  if (open && environmentItems.value.length === 0) {
    fetchEnvironments({ reset: true })
  }
}

const loadMoreEnvironments = () => {
  if (loadingEnvironments.value || !hasMoreEnvs.value) return
  envPage.value += 1
  fetchEnvironments()
}

watch(envSearchTermDebounced, () => {
  // When search changes, reset and fetch
  fetchEnvironments({ reset: true })
})

const upsertMcpOptionCache = (options: Array<{ label: string, value: string }>) => {
  if (!options?.length) return
  const next = { ...mcpOptionCache.value }
  for (const option of options) {
    if (!option?.value) continue
    next[option.value] = option
  }
  mcpOptionCache.value = next
}

const fetchMcps = async (opts?: { reset?: boolean }) => {
  if (!isCodexSelectedEnv.value) return

  const reset = !!opts?.reset
  if (reset) {
    mcpPage.value = 1
    mcpItems.value = []
  }

  loadingMcps.value = true
  try {
    const params: Record<string, any> = {
      page: mcpPage.value,
      limit: mcpLimit.value
    }
    if (mcpSearchTermDebounced.value) {
      params.q = mcpSearchTermDebounced.value
    }

    const data = await $fetch('/api/mcp', { params })
    const mcps = Array.isArray(data?.mcps) ? data.mcps : []
    mcpTotal.value = data?.pagination?.total ?? mcps.length
    if (!mcpSearchTermDebounced.value) {
      mcpKnownTotal.value = mcpTotal.value
    }

    const mapped = mcps
      .map((mcp: any) => ({
        label: typeof mcp?.name === 'string' && mcp.name.trim() ? mcp.name.trim() : 'Unnamed MCP',
        value: typeof mcp?._id === 'string' ? mcp._id : (typeof mcp?.id === 'string' ? mcp.id : '')
      }))
      .filter(item => !!item.value)

    upsertMcpOptionCache(mapped)

    const combined = reset ? mapped : [...mcpItems.value, ...mapped]
    const seen = new Set<string>()
    const deduped: Array<{ label: string, value: string }> = []

    for (const item of combined) {
      if (!item.value || seen.has(item.value)) continue
      seen.add(item.value)
      deduped.push(item)
    }

    for (const id of selectedMcpIds.value) {
      if (seen.has(id)) continue
      const cached = mcpOptionCache.value[id]
      if (cached) {
        seen.add(id)
        deduped.push(cached)
      }
    }

    mcpItems.value = deduped
    mcpFetchedOnce.value = true
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching MCP servers:', error)
    if (!mcpFetchedOnce.value) {
      toast.add({
        title: 'Error',
        description: 'Unable to load MCP servers',
        color: 'error'
      })
    }
  } finally {
    loadingMcps.value = false
  }
}

// Keep selected environment details up to date for provider-specific UI
const selectedEnvironmentDetails = ref<any>(null)
const onEnvironmentSelected = async (rawId: unknown) => {
  const id = normalizeEnvironmentValue(rawId)
  if (!id) {
    selectedEnvironmentDetails.value = null
    return
  }
  try {
    const res = await $fetch(`/api/environments/${id}`)
    selectedEnvironmentDetails.value = res.environment
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching environment details:', error)
    selectedEnvironmentDetails.value = null
  }
}

// If a preselected environment exists, fetch its details once
onMounted(() => {
  if (localSelectedEnvironment.value) {
    onEnvironmentSelected(localSelectedEnvironment.value)
  }
})

// Selected environment object and Codex detection
const selectedEnv = computed(() => {
  return selectedEnvironmentDetails.value || props.environments.find((e: any) => e.id === localSelectedEnvironment.value)
})
const isCodexSelectedEnv = computed(() => {
  const p = selectedEnv.value?.aiProvider
  return p === 'codex-api' || p === 'codex-oauth'
})
const showMcpSelector = computed(() => {
  if (!isCodexSelectedEnv.value) return false
  if (selectedMcpIds.value.length > 0) return true
  if (mcpItems.value.length > 0) return true
  return mcpKnownTotal.value > 0
})

// Reasoning options (Codex)
const reasoningOptions = [
  { label: 'Low reasoning', value: 'low' },
  { label: 'Medium reasoning', value: 'medium' },
  { label: 'High reasoning', value: 'high' }
]
const localReasoningEffort = ref<'low' | 'medium' | 'high'>('medium')

// File path autocomplete computed properties
const filteredFilePaths = computed(() => {
  const query = localInput.value.slice(atPosition.value + 1, cursorPosition.value).toLowerCase()
  return filePaths.value
    .filter(path => path.toLowerCase().includes(query))
    .map(path => ({
      label: path,
      value: path
    }))
    .slice(0, 10) // Limit to 10 results
})

const handleSubmit = async () => {
  if (!localInput.value.trim()) return

  if (!localSelectedEnvironment.value) {
    toast.add({
      title: 'Error',
      description: 'Please select an environment',
      color: 'error'
    })
    return
  }

  try {
    // Create task in database
    const task = await $fetch('/api/tasks', {
      method: 'POST',
      body: {
        environmentId: localSelectedEnvironment.value,
        message: localInput.value,
        planMode: false,
        autoMerge: false,
        // Include Codex AI config if applicable
        aiConfig: isCodexSelectedEnv.value
          ? { model_reasoning_effort: localReasoningEffort.value }
          : undefined,
        selectedMcpIds: isCodexSelectedEnv.value && selectedMcpIds.value.length
          ? selectedMcpIds.value
          : undefined
      }
    })

    toast.add({
      title: 'Task created',
      description: 'Your task has been created successfully',
      color: 'success'
    })

    // Emit event with created task
    emit('submit', {
      message: localInput.value,
      environmentId: localSelectedEnvironment.value,
      task: task.task,
      planMode: false,
      autoMerge: false,
      selectedMcpIds: isCodexSelectedEnv.value ? [...selectedMcpIds.value] : undefined
    })

    // Clear input after emitting event
    localInput.value = ''
  } catch (error) {
    if (import.meta.dev) console.error('Error creating task:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to create task',
      color: 'error'
    })
  }
}

const getRuntimeIcon = (runtime: string) => {
  switch (runtime) {
    case 'node': return 'i-simple-icons-nodedotjs'
    case 'php': return 'i-simple-icons-php'
    case 'python': return 'i-simple-icons-python'
    default: return 'i-heroicons-code-bracket'
  }
}

// File path autocomplete methods
const fetchFilePaths = async (environmentIdRaw: unknown) => {
  const environmentId = normalizeEnvironmentValue(environmentIdRaw)
  if (!environmentId) {
    filePaths.value = []
    return
  }
  try {
    const data = await $fetch(`/api/environments/${environmentId}/file-index`)
    filePaths.value = data.paths || []
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching file paths:', error)
    filePaths.value = []
  }
}

const handleInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  cursorPosition.value = input.selectionStart || 0

  // Check for @ character
  const value = input.value
  const lastAtIndex = value.lastIndexOf('@', cursorPosition.value - 1)

  if (lastAtIndex !== -1) {
    // Check if there's no space between @ and cursor
    const textBetween = value.slice(lastAtIndex + 1, cursorPosition.value)
    if (!textBetween.includes(' ') && !textBetween.includes('\n')) {
      atPosition.value = lastAtIndex
      showFileMenu.value = true
      updateMenuPosition(input)

      // Fetch file paths if not already loaded
      if (filePaths.value.length === 0 && localSelectedEnvironment.value) {
        fetchFilePaths(localSelectedEnvironment.value)
      }
    } else {
      showFileMenu.value = false
    }
  } else {
    showFileMenu.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (showFileMenu.value) {
    if (event.key === 'Escape') {
      showFileMenu.value = false
      event.preventDefault()
    }
  }
}

const updateMenuPosition = (input: HTMLInputElement) => {
  // Create a temporary element to measure text width
  const temp = document.createElement('div')
  temp.style.position = 'absolute'
  temp.style.visibility = 'hidden'
  temp.style.whiteSpace = 'pre'
  temp.style.font = window.getComputedStyle(input).font
  temp.textContent = localInput.value.slice(0, atPosition.value + 1)
  document.body.appendChild(temp)

  const textWidth = temp.offsetWidth
  document.body.removeChild(temp)

  menuPosition.value = {
    top: '100%',
    left: `${Math.min(textWidth, input.offsetWidth - 200)}px`
  }
}

const insertFilePath = (filePath: string) => {
  if (!filePath) return

  const currentValue = localInput.value
  const beforeAt = currentValue.slice(0, atPosition.value)
  const afterCursor = currentValue.slice(cursorPosition.value)

  localInput.value = `${beforeAt}@${filePath} ${afterCursor}`
  showFileMenu.value = false
  selectedFilePath.value = ''

  // Focus back to input
  nextTick(() => {
    const inputElement = chatPromptRef.value?.$el?.querySelector('input') || chatPromptRef.value?.$el?.querySelector('textarea')
    if (inputElement) {
      inputElement.focus()
      const newPosition = beforeAt.length + filePath.length + 2
      inputElement.setSelectionRange(newPosition, newPosition)
    }
  })
}

// Watch for environment changes to load file paths
watch(localSelectedEnvironment, (newEnvironmentId) => {
  if (newEnvironmentId) {
    fetchFilePaths(newEnvironmentId)
  }
})

watch(isCodexSelectedEnv, (isCodex) => {
  if (isCodex) {
    if (!mcpFetchedOnce.value) {
      fetchMcps({ reset: true })
    }
  } else {
    selectedMcpIds.value = []
    mcpItems.value = []
    mcpTotal.value = 0
    mcpKnownTotal.value = 0
    mcpSearchTerm.value = ''
    mcpPage.value = 1
    loadingMcps.value = false
    mcpFetchedOnce.value = false
  }
})

watch(mcpSearchTermDebounced, () => {
  if (!isCodexSelectedEnv.value) return
  fetchMcps({ reset: true })
})

watch(selectedMcpIds, (ids) => {
  if (!ids?.length) return
  const next = { ...mcpOptionCache.value }
  for (const option of mcpItems.value) {
    if (!option.value) continue
    if (!ids.includes(option.value)) continue
    next[option.value] = option
  }
  mcpOptionCache.value = next
})

const onMcpMenuOpen = (open: boolean) => {
  if (!open) return
  if (mcpItems.value.length === 0 && !loadingMcps.value) {
    fetchMcps({ reset: true })
  }
}

const loadMoreMcps = () => {
  if (loadingMcps.value || !hasMoreMcps.value) return
  mcpPage.value += 1
  fetchMcps()
}
</script>
