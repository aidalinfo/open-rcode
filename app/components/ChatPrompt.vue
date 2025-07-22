<template>
  <UChatPrompt 
    v-model="localInput" 
    :status="loading ? 'streaming' : 'ready'"
    placeholder="Posez votre question..."
    @submit="handleSubmit"
  >
    <UChatPromptSubmit />

    <template #footer>
      <USelect
        v-model="localSelectedEnvironment"
        :items="environmentOptions"
        icon="i-heroicons-cube"
        placeholder="Sélectionnez un environnement"
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

// Computed properties pour le two-way binding
const localInput = computed({
  get: () => props.input,
  set: (value) => emit('update:input', value)
})

const localSelectedEnvironment = computed({
  get: () => props.selectedEnvironment,
  set: (value) => emit('update:selectedEnvironment', value)
})

// Options pour le sélecteur d'environnements
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
      title: 'Erreur',
      description: 'Veuillez sélectionner un environnement',
      color: 'error'
    })
    return
  }

  try {
    // Créer la task en base de données
    const task = await $fetch('/api/tasks', {
      method: 'POST',
      body: {
        environmentId: localSelectedEnvironment.value,
        message: localInput.value
      }
    })

    toast.add({
      title: 'Task créée',
      description: 'Votre tâche a été créée avec succès',
      color: 'success'
    })

    // Émettre l'événement avec la task créée
    emit('submit', {
      message: localInput.value,
      environmentId: localSelectedEnvironment.value,
      task: task.task
    })

    // Vider l'input après avoir émis l'événement
    localInput.value = ''
  } catch (error) {
    console.error('Erreur lors de la création de la task:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de créer la tâche',
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