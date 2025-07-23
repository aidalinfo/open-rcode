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
              to="/app/settings/environnement/create"
              icon="i-heroicons-plus"
            >
              Créer un environnement
            </UButton>
          </div>

          <TaskTable v-if="environments.length > 0" />
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
const toast = useToast()
const router = useRouter()

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
    const data = await $fetch<{ environments: any[] }>('/api/environments')
    environments.value = data.environments
  } catch (error) {
    console.error('Erreur lors de la récupération des environnements:', error)
  }
}

const onSubmit = async (data: { message: string; environmentId: string; task?: any }) => {
  if (!data.task || !data.task.id) {
    toast.add({ title: 'Erreur', description: 'La création de la tâche a échoué.', color: 'red' })
    return
  }

  loading.value = true

  try {
    // On redirige immédiatement vers la page de la tâche
    router.push(`/app/task/${data.task.id}`)

    // On lance la création du conteneur en arrière-plan, sans attendre
    $fetch(`/api/tasks/${data.task.id}/container`, {
      method: 'POST'
    }).catch((error) => {
      console.error('Erreur lors de la création du conteneur en arrière-plan:', error)
      // Optionnel: on pourrait utiliser WebSocket ou une notification pour informer l'utilisateur de l'échec
      toast.add({
        title: 'Erreur de conteneur',
        description: 'La création de l\'environnement Docker a échoué en arrière-plan.',
        color: 'red',
        timeout: 0 // Garder la notif visible
      })
    })
  } catch (error) {
    console.error('Erreur lors de la redirection ou de l\'appel fetch:', error)
    toast.add({ title: 'Erreur', description: 'Une erreur est survenue.', color: 'red' })
    loading.value = false
  }
  // loading.value n'est pas remis à false ici car la page change.
}

// Chargement initial
onBeforeMount(async () => {
  await fetchEnvironments()
})
</script>