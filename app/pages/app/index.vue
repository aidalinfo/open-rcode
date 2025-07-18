<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-6">
          <UChatPrompt 
            v-model="input" 
            :status="loading ? 'streaming' : 'ready'"
            placeholder="Posez votre question..."
            @submit="onSubmit"
          >
            <UChatPromptSubmit />

            <template #footer>
              <USelect
                v-model="selectedEnvironment"
                :items="environmentOptions"
                icon="i-heroicons-cube"
                placeholder="Sélectionnez un environnement"
                variant="ghost"
                :disabled="environments.length === 0"
              />
            </template>
          </UChatPrompt>

          <div v-if="environments.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun environnement configuré
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez votre premier environnement pour commencer à utiliser le chat.
            </p>
            <UButton
              to="/app/settings/environnement"
              icon="i-heroicons-plus"
            >
              Créer un environnement
            </UButton>
          </div>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
const toast = useToast()

// États réactifs
const input = ref('')
const loading = ref(false)
const environments = ref<any[]>([])
const selectedEnvironment = ref('')

// Options pour le sélecteur d'environnements
const environmentOptions = computed(() => {
  return environments.value.map((env: any) => ({
    label: `${env.name} (${env.repositoryFullName})`,
    value: env.id,
    icon: getRuntimeIcon(env.runtime)
  }))
})

// Méthodes
const fetchEnvironments = async () => {
  try {
    const data = await $fetch('/api/environments')
    environments.value = data.environments
  } catch (error) {
    console.error('Erreur lors de la récupération des environnements:', error)
  }
}

const onSubmit = async () => {
  if (!input.value.trim()) return
  
  if (!selectedEnvironment.value) {
    toast.add({
      title: 'Erreur',
      description: 'Veuillez sélectionner un environnement',
      color: 'error'
    })
    return
  }

  loading.value = true
  
  try {
    // Ici vous pouvez ajouter la logique pour envoyer le message au chat
    console.log('Message:', input.value)
    console.log('Environnement:', selectedEnvironment.value)
    
    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    toast.add({
      title: 'Message envoyé',
      description: 'Votre message a été traité avec succès',
      color: 'success'
    })
    
    input.value = ''
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Erreur lors de l\'envoi du message',
      color: 'error'
    })
  } finally {
    loading.value = false
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

// Chargement initial
onMounted(() => {
  fetchEnvironments()
})
</script>