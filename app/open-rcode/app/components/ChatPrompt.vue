<template>
  <UChatPrompt 
    v-model="localInput" 
    :status="loading ? 'streaming' : 'ready'"
    placeholder="Ask your question..."
    @submit="handleSubmit"
  >
    <UChatPromptSubmit />

    <template #footer>
      <USelect
        v-model="localSelectedEnvironment"
        :items="environmentOptions"
        icon="i-heroicons-cube"
        placeholder="Select an environment"
        variant="ghost"
        :disabled="environments.length === 0"
      />
    </template>
  </UChatPrompt>
</template>

<script setup lang="ts">
interface Props {
  input: string
  selectedEnvironment: string
  environments: any[]
  loading: boolean
}

interface Emits {
  (e: 'update:input', value: string): void
  (e: 'update:selectedEnvironment', value: string): void
  (e: 'submit', data: { message: string; environmentId: string; task?: any }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toast = useToast()

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
        message: localInput.value
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
      task: task.task
    })

    // Clear input after emitting event
    localInput.value = ''
  } catch (error) {
    console.error('Error creating task:', error)
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