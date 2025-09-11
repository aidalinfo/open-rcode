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
        <div class="flex flex-wrap items-center gap-3">
          <USelectMenu
            v-model="localSelectedEnvironment"
            v-model:search-term="envSearchTerm"
            :items="environmentItems"
            :loading="loadingEnvironments"
            option-attribute="label"
            value-attribute="value"
            icon="i-heroicons-cube"
            placeholder="Select an environment"
            variant="ghost"
            class="w-full sm:w-auto"
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
                  @click="loadMoreEnvironments"
                >
                  Load more
                </UButton>
              </div>
            </template>
          </USelectMenu>

          <!-- Reasoning select shown only for Codex providers -->
          <USelect
            v-if="isCodexSelectedEnv"
            v-model="localReasoningEffort"
            :items="reasoningOptions"
            icon="i-heroicons-sparkles"
            placeholder="Reasoning"
            variant="ghost"
            class="w-full sm:w-auto"
          />
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
  (e: 'submit', data: { message: string, environmentId: string, task?: any, planMode?: boolean, autoMerge?: boolean }): void
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

const localSelectedEnvironment = computed({
  get: () => props.selectedEnvironment,
  set: value => emit('update:selectedEnvironment', value)
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

// Keep selected environment details up to date for provider-specific UI
const selectedEnvironmentDetails = ref<any>(null)
const onEnvironmentSelected = async (id: string) => {
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
      autoMerge: false
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
const fetchFilePaths = async (environmentId: string) => {
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
</script>
