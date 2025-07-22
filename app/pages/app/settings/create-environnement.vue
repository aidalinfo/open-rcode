<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Environnements
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Gérez vos environnements de déploiement
        </p>
      </div>

      <!-- Formulaire de création -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            {{ isEditing ? 'Modifier l\'environnement' : 'Créer un nouvel environnement' }}
          </h2>
        </template>

        <UForm :state="form" @submit="submitForm" class="space-y-12">
          <!-- Sélection du repository -->
          <UFormField label="Repository" name="repository" required class="mt-8">
            <USelectMenu
              v-model="form.selectedRepository"
              :items="repositoryOptions"
              placeholder="Sélectionnez un repository"
              :loading="loadingRepositories"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Nom de l'environnement -->
          <UFormField label="Nom" name="name" required class="mt-10">
            <UInput
              v-model="form.name"
              placeholder="ex: Production, Staging, Development"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Description -->
          <UFormField label="Description" name="description" class="mt-10">
            <UTextarea
              v-model="form.description"
              placeholder="Description de l'environnement"
              :rows="3"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Runtime -->
          <UFormField label="Runtime d'exécution" name="runtime" required class="mt-10">
            <USelectMenu
              v-model="form.runtime"
              :items="runtimeOptions"
              placeholder="Sélectionnez un runtime"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Provider IA -->
          <UFormField label="Provider d'Intelligence Artificielle" name="aiProvider" required class="mt-10">
            <USelectMenu
              v-model="form.aiProvider"
              :items="aiProviderOptions"
              placeholder="Sélectionnez un provider IA"
              size="lg"
              class="w-full"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                {{ getAiProviderDescription(form.aiProvider?.value || form.aiProvider) }}
              </p>
            </template>
          </UFormField>

          <!-- Variables d'environnement -->
          <div class="space-y-6 mt-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                Variables de l'environnement
              </h3>
              <UButton
                @click="addVariable"
                variant="outline"
                size="sm"
              >
                <template #leading>
                  <UIcon name="i-heroicons-plus" />
                </template>
                Ajouter
              </UButton>
            </div>
            
            <div v-if="form.environmentVariables.length > 0" class="space-y-6 mt-6">
              <div
                v-for="(variable, index) in form.environmentVariables"
                :key="index"
                class="flex items-center gap-4"
              >
                <div class="flex-1">
                  <UInput
                    v-model="variable.key"
                    placeholder="Clé (ex: NODE_ENV)"
                    size="lg"
                    class="w-full"
                  />
                </div>
                <div class="flex-1">
                  <UInput
                    v-model="variable.value"
                    placeholder="Valeur (ex: production)"
                    size="lg"
                    class="w-full"
                  />
                </div>
                <UButton
                  @click="removeVariable(index)"
                  color="error"
                  variant="ghost"
                  size="lg"
                  class="shrink-0"
                >
                  <UIcon name="i-heroicons-trash" />
                </UButton>
              </div>
            </div>
          </div>

          <!-- Script de configuration -->
          <UFormField label="Script de configuration" name="configurationScript" class="mt-10">
            <UTextarea
              v-model="form.configurationScript"
              placeholder="ex: npm install && npm run build"
              :rows="4"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Boutons d'action -->
          <div class="flex justify-end gap-3 mt-12">
            <UButton
              v-if="isEditing"
              @click="cancelEdit"
              variant="ghost"
            >
              Annuler
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
            >
              {{ isEditing ? 'Modifier' : 'Créer' }}
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- Liste des environnements -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">
              Environnements existants
            </h2>
            <UButton
              @click="fetchEnvironments"
              variant="ghost"
              size="sm"
              :loading="loadingEnvironments"
            >
              <template #leading>
                <UIcon name="i-heroicons-arrow-path" />
              </template>
              Actualiser
            </UButton>
          </div>
        </template>

        <div v-if="environments.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-cube" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Aucun environnement
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Créez votre premier environnement ci-dessus.
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
                @click="editEnvironment(environment)"
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

// États réactifs
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const isSubmitting = ref(false)
const loadingRepositories = ref(false)
const loadingEnvironments = ref(false)

// Données
const repositories = ref<any[]>([])
const environments = ref<any[]>([])

// Formulaire
const form = ref({
  selectedRepository: { label: 'Please select a repository', value: '', description: '' },
  name: '',
  description: '',
  runtime: { label: 'Node.js', value: 'node' },
  aiProvider: 'anthropic-api',
  environmentVariables: [] as Array<{ key: string; value: string; description: string }>,
  configurationScript: ''
})

// Options
const runtimeOptions = [
  { label: 'Node.js', value: 'node' },
  { label: 'PHP', value: 'php' },
  { label: 'Python', value: 'python' }
]

const aiProviderOptions = [
  { label: 'API Anthropic (Claude)', value: 'anthropic-api' },
  { label: 'OAuth Claude Code CLI', value: 'claude-oauth' },
  { label: 'Google Gemini CLI', value: 'gemini-cli' }
]

const repositoryOptions = computed(() => {
  return repositories.value.map((repo: any) => ({
    label: repo.full_name,
    value: repo.full_name,
    description: repo.description || 'Aucune description'
  }))
})

// Méthodes
const fetchRepositories = async () => {
  loadingRepositories.value = true
  try {
    const data = await $fetch('/api/repositories')
    repositories.value = data.repositories
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les repositories',
      color: 'error'
    })
  } finally {
    loadingRepositories.value = false
  }
}

const fetchEnvironments = async () => {
  loadingEnvironments.value = true
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
    loadingEnvironments.value = false
  }
}

// Watcher pour détecter les changements de repository
watch(() => form.value.selectedRepository, (newValue) => {
  const repoValue = newValue?.value || newValue
  if (repoValue && !form.value.name) {
    form.value.name = 'Production'
  }
})

const addVariable = () => {
  form.value.environmentVariables.push({ key: '', value: '', description: '' })
}

const removeVariable = (index: number) => {
  form.value.environmentVariables.splice(index, 1)
}

const getAiProviderDescription = (provider: string) => {
  const descriptions = {
    'anthropic-api': 'Utilise votre clé API Anthropic pour appeler Claude directement via API.',
    'claude-oauth': 'Utilise votre token OAuth pour Claude Code CLI (recommandé pour les fonctionnalités avancées).',
    'gemini-cli': 'Utilise votre clé API Google pour appeler Gemini via CLI.'
  }
  return descriptions[provider as keyof typeof descriptions] || ''
}

const getAiProviderLabel = (provider: string) => {
  const labels = {
    'anthropic-api': 'API Anthropic (Claude)',
    'claude-oauth': 'OAuth Claude Code CLI',
    'gemini-cli': 'Google Gemini CLI'
  }
  return labels[provider as keyof typeof labels] || provider
}

const submitForm = async () => {
  isSubmitting.value = true
  try {
    const selectedRepo = form.value.selectedRepository?.value || form.value.selectedRepository
    console.log('selectedRepository:', selectedRepo, typeof selectedRepo)
    
    if (!selectedRepo || typeof selectedRepo !== 'string') {
      toast.add({
        title: 'Erreur',
        description: 'Veuillez sélectionner un repository',
        color: 'error'
      })
      return
    }
    
    const [organization, repository] = selectedRepo.split('/')
    const selectedRuntime = form.value.runtime?.value || form.value.runtime
    const selectedAiProvider = form.value.aiProvider?.value || form.value.aiProvider
    
    console.log('FORM VALUES:')
    console.log('- form.value:', form.value)
    console.log('- selectedRuntime:', selectedRuntime, typeof selectedRuntime)
    console.log('- selectedAiProvider:', selectedAiProvider, typeof selectedAiProvider)
    console.log('- form.value.aiProvider:', form.value.aiProvider)
    
    const payload = {
      organization,
      repository,
      name: form.value.name,
      description: form.value.description,
      runtime: selectedRuntime,
      aiProvider: selectedAiProvider,
      environmentVariables: form.value.environmentVariables.filter(v => v.key && v.value),
      configurationScript: form.value.configurationScript
    }

    if (isEditing.value) {
      await $fetch(`/api/environments/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Succès',
        description: 'Environnement modifié avec succès',
        color: 'success'
      })
    } else {
      await $fetch('/api/environments', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Succès',
        description: 'Environnement créé avec succès',
        color: 'success'
      })
    }

    resetForm()
    await fetchEnvironments()
  } catch (error) {
    console.error('Erreur lors de la soumission du formulaire:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder l\'environnement',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const editEnvironment = (environment: any) => {
  isEditing.value = true
  editingId.value = environment.id
  form.value = {
    selectedRepository: environment.repositoryFullName,
    name: environment.name,
    description: environment.description || '',
    runtime: environment.runtime,
    aiProvider: environment.aiProvider || 'anthropic-api',
    environmentVariables: environment.environmentVariables || [],
    configurationScript: environment.configurationScript || ''
  }
}

const cancelEdit = () => {
  resetForm()
}

const resetForm = () => {
  isEditing.value = false
  editingId.value = null
  form.value = {
    selectedRepository: '',
    name: '',
    description: '',
    runtime: '',
    aiProvider: 'anthropic-api',
    environmentVariables: [],
    configurationScript: ''
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

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR')
}

// Chargement initial
onMounted(() => {
  fetchRepositories()
  fetchEnvironments()
})
</script>