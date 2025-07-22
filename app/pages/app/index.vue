<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-6">
          <ChatPrompt
            v-model:input="input"
            v-model:selectedEnvironment="selectedEnvironment"
            :environments="environments"
            :loading="loading"
            @submit="onSubmit"
          />

          <div v-if="environments.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun environnement configuré
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez votre premier environnement pour commencer à utiliser le chat.
            </p>
            <UButton
              to="/app/settings/create-environnement"
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
definePageMeta({
  middleware: 'auth'
})
// États réactifs
const input = ref('')
const loading = ref(false)
const environments = ref<any[]>([])
const selectedEnvironment = ref('')

// Méthodes
const fetchEnvironments = async () => {
  try {
    const data = await $fetch('/api/environments')
    environments.value = data.environments
  } catch (error) {
    console.error('Erreur lors de la récupération des environnements:', error)
  }
}

const onSubmit = async (data: { message: string; environmentId: string; task?: any }) => {
  loading.value = true
  
  try {
    console.log('Task créée:', data.task)
    
    if (data.task) {
      // Créer automatiquement le conteneur Docker pour la tâche
      try {
        const containerResult = await $fetch(`/api/tasks/${data.task.id}/container`, {
          method: 'POST',
          body: {}
        })
        
        console.log('Conteneur créé:', containerResult.container)
        
        toast.add({
          title: 'Conteneur créé',
          description: `Environnement Docker initialisé avec Claude Code`,
          color: 'success'
        })
        
      } catch (containerError) {
        console.error('Erreur lors de la création du conteneur:', containerError)
        toast.add({
          title: 'Erreur conteneur',
          description: 'Impossible de créer l\'environnement Docker',
          color: 'error'
        })
      }
    }
    
  } catch (error) {
    console.error('Erreur lors du traitement:', error)
  } finally {
    loading.value = false
  }
}

// Chargement initial
onMounted(() => {
  fetchEnvironments()
})
</script>