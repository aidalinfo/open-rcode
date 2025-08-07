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
        <USelect
          v-model="localSelectedEnvironment"
          :items="environmentOptions"
          icon="i-heroicons-cube"
          placeholder="Select an environment"
          variant="ghost"
          :disabled="environments.length === 0"
          class="w-full sm:w-auto"
        />
        
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <UDropdownMenu :items="workflowOptions">
            <UButton
              variant="ghost"
              icon="i-heroicons-cog-6-tooth"
              size="sm"
            >
              Workflow
            </UButton>
          </UDropdownMenu>
          
          <div v-if="selectedWorkflow" class="flex items-center">
            <UBadge
              color="primary"
              variant="solid"
              size="sm"
              class="flex items-center gap-1 pr-1"
            >
              {{ selectedWorkflow }}
              <UButton
                variant="ghost"
                size="2xs"
                icon="i-heroicons-x-mark"
                class="ml-2 h-4 w-4 p-0 text-white dark:text-black"
                @click="removeWorkflow"
              />
            </UBadge>
          </div>
        </div>
        
      </div>
    </template>
  </UChatPrompt>
  
  <!-- File Path Autocomplete -->
  <div v-if="showFileMenu && filteredFilePaths.length > 0" class="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-80" :style="menuPosition">
    <div class="p-2">
      <div class="text-xs text-gray-500 mb-2">Select a file path:</div>
      <div class="space-y-1">
        <button
          v-for="item in filteredFilePaths"
          :key="item.value"
          @click="insertFilePath(item.value)"
          class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
        >
          <div class="font-medium">{{ item.label }}</div>
        </button>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
interface Props {
  input: string
  selectedEnvironment: string
  environments: any[]
  loading: boolean
}

interface Emits {
  (e: 'update:input', value: string): void
  (e: 'update:selectedEnvironment', value: string): void
  (e: 'submit', data: { message: string; environmentId: string; task?: any; planMode?: boolean }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toast = useToast()

// Workflow state
const selectedWorkflow = ref('')

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
  set: (value) => emit('update:input', value)
})

const localSelectedEnvironment = computed({
  get: () => props.selectedEnvironment,
  set: (value) => emit('update:selectedEnvironment', value)
})

// Options for environment selector
const environmentOptions = computed(() => {
  return props.environments.map((env: any) => ({
    label: `${env.name} (${env.repositoryFullName})`,
    value: env.id,
    icon: getRuntimeIcon(env.runtime)
  }))
})

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

// Options for workflow dropdown
const workflowOptions = computed(() => [{
  label: 'Plan Mode Workflow',
  icon: 'i-heroicons-cpu-chip',
  onSelect() {
    selectedWorkflow.value = 'Plan Mode Workflow'
  }
}, {
  label: 'Auto PR with Merge',
  icon: 'i-heroicons-arrow-path-rounded-square',
  onSelect() {
    selectedWorkflow.value = 'Auto PR with Merge'
  }
}])

// Workflow methods
const removeWorkflow = () => {
  selectedWorkflow.value = ''
}

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
        planMode: selectedWorkflow.value === 'Plan Mode Workflow',
        autoMerge: selectedWorkflow.value === 'Auto PR with Merge'
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
      planMode: selectedWorkflow.value === 'Plan Mode Workflow',
      autoMerge: selectedWorkflow.value === 'Auto PR with Merge'
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