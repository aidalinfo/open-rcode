<template>
  <UChatPrompt 
    v-model="localInput" 
    :status="loading ? 'streaming' : 'ready'"
    placeholder="Ask your question..."
    @submit="handleSubmit"
  >
    <UChatPromptSubmit />

    <template #footer>
      <div class="flex items-center gap-3">
        <USelect
          v-model="localSelectedEnvironment"
          :items="environmentOptions"
          icon="i-heroicons-cube"
          placeholder="Select an environment"
          variant="ghost"
          :disabled="environments.length === 0"
        />
        
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
    </template>
  </UChatPrompt>
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

// Options for workflow dropdown
const workflowOptions = computed(() => [{
  label: 'Plan Mode Workflow',
  icon: 'i-heroicons-cpu-chip',
  onSelect() {
    selectedWorkflow.value = 'Plan Mode Workflow'
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
        planMode: selectedWorkflow.value === 'Plan Mode Workflow'
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
      planMode: selectedWorkflow.value === 'Plan Mode Workflow'
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
</script>