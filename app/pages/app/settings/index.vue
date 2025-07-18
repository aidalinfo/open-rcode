<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Paramètres
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Gérez vos paramètres et configurations
        </p>
      </div>

      <!-- API Key Anthropic -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Clé API Anthropic
          </h2>
        </template>

        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400">
            {{ hasAnthropicKey ? 'Votre clé API Anthropic est configurée et chiffrée de manière sécurisée.' : 'Configurez votre clé API Anthropic pour utiliser le chat IA.' }}
          </p>

          <div v-if="!hasAnthropicKey" class="space-y-4">
            <UFormGroup label="Clé API Anthropic" name="anthropicKey">
              <div class="flex gap-2">
                <UInput
                  v-model="anthropicKeyInput"
                  type="password"
                  placeholder="sk-ant-..."
                  size="lg"
                  class="flex-1"
                  :disabled="savingApiKey"
                />
                <UButton
                  @click="saveAnthropicKey"
                  :loading="savingApiKey"
                  :disabled="!anthropicKeyInput || !anthropicKeyInput.startsWith('sk-ant-')"
                  size="lg"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-key" />
                  </template>
                  Sauvegarder
                </UButton>
              </div>
            </UFormGroup>
          </div>

          <div v-else class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-shield-check" class="text-green-500" />
              <span class="text-sm font-medium text-green-700 dark:text-green-400">
                Clé API configurée
              </span>
            </div>
            <UButton
              @click="resetAnthropicKey"
              variant="ghost"
              size="sm"
              color="red"
            >
              <template #leading>
                <UIcon name="i-heroicons-trash" />
              </template>
              Supprimer
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Connexion GitHub App -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Connexion GitHub App
          </h2>
        </template>

        <div v-if="loadingGithubStatus" class="space-y-4">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-10 w-48" />
        </div>

        <div v-else class="space-y-4">
          <UAlert
            v-if="route.query.success === 'github_app_installed'"
            color="green"
            variant="soft"
            title="Succès"
            description="Votre GitHub App a été installée avec succès !"
          />
          
          <UAlert
            v-if="route.query.error === 'github_app_auth_failed'"
            color="red"
            variant="soft"
            title="Erreur"
            description="Erreur lors de la connexion à GitHub App. Veuillez réessayer."
          />

          <p class="text-gray-600 dark:text-gray-400">
            {{ hasGithubApp ? 'Modifiez les droits de votre GitHub App sur vos repositories.' : 'Installez notre GitHub App sur vos repositories pour permettre l\'interaction avec vos projets.' }}
          </p>

          <UButton
            @click="installGitHubApp"
            variant="outline"
            size="lg"
            :loading="isInstalling"
          >
            <template #leading>
              <UIcon name="i-simple-icons-github" class="w-5 h-5" />
            </template>
            {{ hasGithubApp ? 'Modifier les droits GitHub' : 'Installer GitHub App' }}
          </UButton>
        </div>
      </UCard>

      <!-- Tableau des environnements -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">
              Environnements
            </h2>
            <UButton
              to="/app/settings/environnement"
              icon="i-heroicons-plus"
              size="sm"
            >
              New environnement
            </UButton>
          </div>
        </template>

        <div v-if="environments.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Aucun environnement
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Créez votre premier environnement pour commencer.
          </p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="environment in environments"
            :key="environment.id"
            class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ environment.name }}
                </h3>
                <UBadge :color="getRuntimeColor(environment.runtime)" size="xs">
                  {{ environment.runtime }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ environment.repositoryFullName }}
              </p>
              <p v-if="environment.description" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ environment.description }}
              </p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{{ environment.environmentVariables.length }} variables</span>
                <span>Créé le {{ formatDate(environment.createdAt) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                :to="`/app/settings/environnement?edit=${environment.id}`"
                variant="ghost"
                size="sm"
              >
                <template #leading>
                  <UIcon name="i-heroicons-pencil-square" />
                </template>
                Modifier
              </UButton>
              <UButton
                @click="deleteEnvironment(environment.id)"
                color="error"
                variant="ghost"
                size="sm"
              >
                <template #leading>
                  <UIcon name="i-heroicons-trash" />
                </template>
                Supprimer
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const toast = useToast()
const route = useRoute()

// États réactifs
const environments = ref<any[]>([])
const loading = ref(false)
const isInstalling = ref(false)
const hasGithubApp = ref(false)
const loadingGithubStatus = ref(true)
const hasAnthropicKey = ref(false)
const anthropicKeyInput = ref('')
const savingApiKey = ref(false)

// Méthodes
const fetchEnvironments = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/environments')
    environments.value = data.environments
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les environnements',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const deleteEnvironment = async (id: string) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cet environnement ?')) {
    try {
      await $fetch(`/api/environments/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Succès',
        description: 'Environnement supprimé avec succès',
        color: 'success'
      })
      await fetchEnvironments()
    } catch (error) {
      toast.add({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'environnement',
        color: 'error'
      })
    }
  }
}

const getRuntimeColor = (runtime: string) => {
  switch (runtime) {
    case 'node': return 'success'
    case 'php': return 'info'
    case 'python': return 'warning'
    default: return 'secondary'
  }
}

const installGitHubApp = () => {
  isInstalling.value = true
  window.location.href = '/api/auth/github-app'
}

const checkGithubAppStatus = async () => {
  try {
    const data = await $fetch('/api/repositories')
    hasGithubApp.value = data.repositories && data.repositories.length > 0
  } catch (error) {
    hasGithubApp.value = false
  } finally {
    loadingGithubStatus.value = false
  }
}

const checkAnthropicKey = async () => {
  try {
    const data = await $fetch('/api/user/anthropic-key')
    hasAnthropicKey.value = data.hasApiKey
  } catch (error) {
    console.error('Erreur lors de la vérification de la clé API:', error)
  }
}

const saveAnthropicKey = async () => {
  if (!anthropicKeyInput.value || !anthropicKeyInput.value.startsWith('sk-ant-')) {
    toast.add({
      title: 'Erreur',
      description: 'Veuillez entrer une clé API Anthropic valide',
      color: 'error'
    })
    return
  }

  savingApiKey.value = true
  try {
    await $fetch('/api/user/anthropic-key', {
      method: 'PUT',
      body: { anthropicKey: anthropicKeyInput.value }
    })
    
    toast.add({
      title: 'Succès',
      description: 'Clé API sauvegardée avec succès',
      color: 'success'
    })
    
    hasAnthropicKey.value = true
    anthropicKeyInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder la clé API',
      color: 'error'
    })
  } finally {
    savingApiKey.value = false
  }
}

const resetAnthropicKey = async () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer votre clé API Anthropic ?')) {
    try {
      await $fetch('/api/user/anthropic-key', {
        method: 'PUT',
        body: { anthropicKey: '' }
      })
      
      toast.add({
        title: 'Succès',
        description: 'Clé API supprimée avec succès',
        color: 'success'
      })
      
      hasAnthropicKey.value = false
    } catch (error) {
      toast.add({
        title: 'Erreur',
        description: 'Impossible de supprimer la clé API',
        color: 'error'
      })
    }
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR')
}

// Chargement initial
onMounted(async () => {
  await Promise.all([
    fetchEnvironments(),
    checkGithubAppStatus(),
    checkAnthropicKey()
  ])
})
</script>