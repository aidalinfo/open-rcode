<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Modifier l'environnement
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Modifiez la configuration de votre environnement
        </p>
      </div>

      <!-- Loading state -->
      <div v-if="isLoadingEnvironment" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-500" />
      </div>

      <!-- Error state -->
      <UAlert
        v-if="loadError"
        color="error"
        variant="soft"
        :title="loadError"
        class="mb-6"
      />

      <!-- Formulaire de modification -->
      <UCard v-if="!isLoadingEnvironment && !loadError">
        <template #header>
          <h2 class="text-xl font-semibold">
            Configuration de l'environnement
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
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                {{ getAiProviderDescription(form.aiProvider?.value) }}
              </p>
            </template>
          </UFormField>

          <!-- Modèle IA -->
          <UFormField v-if="canSelectModel" label="Modèle d'Intelligence Artificielle" name="model" required class="mt-10">
            <USelectMenu
              v-model="form.model"
              :items="modelOptions"
              placeholder="Sélectionnez un modèle"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                {{ getModelDescription(form.model?.value) }}
              </p>
            </template>
          </UFormField>

          <!-- Branche par défaut -->
          <UFormField label="Branche par défaut" name="defaultBranch" required class="mt-10">
            <USelectMenu
              v-model="form.defaultBranch"
              :items="branchOptions"
              placeholder="Sélectionnez une branche"
              :loading="loadingBranches"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
              :disabled="!selectedRepository"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                Cette branche sera utilisée pour le clonage du repository et la création des pull requests.
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
          <div class="flex justify-between gap-3 mt-12">
            <UButton
              @click="goBack"
              variant="ghost"
            >
              <template #leading>
                <UIcon name="i-heroicons-arrow-left" />
              </template>
              Retour
            </UButton>
            
            <div class="flex gap-3">
              <UButton
                @click="deleteEnvironment"
                color="error"
                variant="outline"
                :loading="isDeleting"
              >
                <template #leading>
                  <UIcon name="i-heroicons-trash" />
                </template>
                Supprimer
              </UButton>
              <UButton
                type="submit"
                :loading="isSubmitting"
              >
                <template #leading>
                  <UIcon name="i-heroicons-check" />
                </template>
                Sauvegarder
              </UButton>
            </div>
          </div>
        </UForm>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const toast = useToast()
const route = useRoute()
const router = useRouter()

// Get environment ID from query params
const environmentId = computed(() => route.query.edit as string)

// États réactifs
const isLoadingEnvironment = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)
const isDeleting = ref(false)
const loadingRepositories = ref(false)
const loadingBranches = ref(false)

// Données
const repositories = ref<any[]>([])
const branches = ref<any[]>([])
const currentEnvironment = ref<any>(null)

// Formulaire
const form = ref({
  selectedRepository: { label: '', value: '', description: '' },
  name: '',
  description: '',
  runtime: { label: 'Node.js', value: 'node' },
  aiProvider: { label: 'API Anthropic (Claude)', value: 'anthropic-api' },
  model: { label: 'Claude Sonnet', value: 'sonnet' },
  defaultBranch: { label: 'main', value: 'main' },
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

const modelOptions = [
  { label: 'Claude Sonnet', value: 'sonnet' },
  { label: 'Claude Opus', value: 'opus' }
]

const repositoryOptions = computed(() => {
  return repositories.value.map((repo: any) => ({
    label: repo.full_name,
    value: repo.full_name,
    description: repo.description || 'Aucune description'
  }))
})

const branchOptions = computed(() => {
  return branches.value.map((branch: any) => ({
    label: branch.name,
    value: branch.name,
    description: branch.protected ? 'Branche protégée' : ''
  }))
})

const selectedRepository = computed(() => {
  return form.value.selectedRepository?.value || form.value.selectedRepository
})

const canSelectModel = computed(() => {
  const provider = form.value.aiProvider?.value || form.value.aiProvider
  return provider === 'anthropic-api' || provider === 'claude-oauth'
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

const fetchBranches = async (repositoryFullName: string) => {
  if (!repositoryFullName) return
  
  loadingBranches.value = true
  try {
    const [owner, repo] = repositoryFullName.split('/')
    const data = await $fetch(`/api/repositories/${owner}/${repo}/branches`)
    branches.value = data.branches
  } catch (error) {
    console.error('Erreur lors de la récupération des branches:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les branches du repository',
      color: 'error'
    })
    branches.value = []
  } finally {
    loadingBranches.value = false
  }
}

const fetchEnvironment = async () => {
  if (!environmentId.value) {
    loadError.value = 'ID d\'environnement manquant'
    isLoadingEnvironment.value = false
    return
  }

  try {
    isLoadingEnvironment.value = true
    const data = await $fetch(`/api/environments/${environmentId.value}`)
    currentEnvironment.value = data.environment
    
    console.log('ENVIRONMENT DATA RECEIVED:')
    console.log('- Full data:', data)
    console.log('- environment:', data.environment)
    console.log('- aiProvider:', data.environment.aiProvider, typeof data.environment.aiProvider)
    console.log('- model:', data.environment.model, typeof data.environment.model)
    console.log('- runtime:', data.environment.runtime, typeof data.environment.runtime)
    console.log('- environmentVariables:', data.environment.environmentVariables)
    
    // Récupérer les branches du repository
    await fetchBranches(data.environment.repositoryFullName)
    
    // Remplir le formulaire avec les données existantes
    form.value = {
      selectedRepository: {
        label: data.environment.repositoryFullName,
        value: data.environment.repositoryFullName,
        description: ''
      },
      name: data.environment.name,
      description: data.environment.description,
      runtime: {
        label: getRuntimeLabel(data.environment.runtime),
        value: data.environment.runtime
      },
      aiProvider: {
        label: getAiProviderLabel(data.environment.aiProvider),
        value: data.environment.aiProvider
      },
      model: {
        label: getModelLabel(data.environment.model || 'sonnet'),
        value: data.environment.model || 'sonnet'
      },
      defaultBranch: {
        label: data.environment.defaultBranch || 'main',
        value: data.environment.defaultBranch || 'main'
      },
      environmentVariables: data.environment.environmentVariables || [],
      configurationScript: data.environment.configurationScript
    }
  } catch (error) {
    console.error('Erreur lors du chargement de l\'environnement:', error)
    loadError.value = 'Impossible de charger l\'environnement'
  } finally {
    isLoadingEnvironment.value = false
  }
}

const getRuntimeLabel = (runtime: string) => {
  const labels = {
    'node': 'Node.js',
    'php': 'PHP',
    'python': 'Python'
  }
  return labels[runtime as keyof typeof labels] || runtime
}

const getAiProviderLabel = (provider: string) => {
  const labels = {
    'anthropic-api': 'API Anthropic (Claude)',
    'claude-oauth': 'OAuth Claude Code CLI',
    'gemini-cli': 'Google Gemini CLI'
  }
  return labels[provider as keyof typeof labels] || provider
}

const getAiProviderDescription = (provider: string) => {
  const descriptions = {
    'anthropic-api': 'Utilise votre clé API Anthropic pour appeler Claude directement via API.',
    'claude-oauth': 'Utilise votre token OAuth pour Claude Code CLI (recommandé pour les fonctionnalités avancées).',
    'gemini-cli': 'Utilise votre clé API Google pour appeler Gemini via CLI.'
  }
  return descriptions[provider as keyof typeof descriptions] || ''
}

const getModelLabel = (model: string) => {
  const labels = {
    'sonnet': 'Claude Sonnet',
    'opus': 'Claude Opus'
  }
  return labels[model as keyof typeof labels] || model
}

const getModelDescription = (model: string) => {
  const descriptions = {
    'sonnet': 'Claude Sonnet - Modèle équilibré entre performance et vitesse (recommandé).',
    'opus': 'Claude Opus - Modèle le plus puissant pour les tâches complexes.'
  }
  return descriptions[model as keyof typeof descriptions] || ''
}

const addVariable = () => {
  form.value.environmentVariables.push({ key: '', value: '', description: '' })
}

const removeVariable = (index: number) => {
  form.value.environmentVariables.splice(index, 1)
}

const submitForm = async () => {
  isSubmitting.value = true
  try {
    const selectedRepo = form.value.selectedRepository?.value || form.value.selectedRepository
    
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
    const selectedModel = canSelectModel.value ? (form.value.model?.value || form.value.model) : null
    
    console.log('UPDATE FORM VALUES:')
    console.log('- selectedAiProvider:', selectedAiProvider, typeof selectedAiProvider)
    console.log('- selectedModel:', selectedModel, typeof selectedModel)
    console.log('- form.value.aiProvider:', form.value.aiProvider)
    
    const selectedDefaultBranch = form.value.defaultBranch?.value || form.value.defaultBranch
    
    const payload = {
      organization,
      repository,
      name: form.value.name,
      description: form.value.description,
      runtime: selectedRuntime,
      aiProvider: selectedAiProvider,
      model: selectedModel,
      defaultBranch: selectedDefaultBranch,
      environmentVariables: form.value.environmentVariables.filter(v => v.key && v.value),
      configurationScript: form.value.configurationScript
    }

    await $fetch(`/api/environments/${environmentId.value}`, {
      method: 'PUT',
      body: payload
    })
    
    toast.add({
      title: 'Succès',
      description: 'Environnement mis à jour avec succès',
      color: 'success'
    })
    
    // Rediriger vers la page des paramètres
    router.push('/app/settings')
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de mettre à jour l\'environnement',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const deleteEnvironment = async () => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cet environnement ? Cette action est irréversible.')) {
    return
  }

  isDeleting.value = true
  try {
    await $fetch(`/api/environments/${environmentId.value}`, {
      method: 'DELETE'
    })
    
    toast.add({
      title: 'Succès',
      description: 'Environnement supprimé avec succès',
      color: 'success'
    })
    
    // Rediriger vers la page des paramètres
    router.push('/app/settings')
    
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de supprimer l\'environnement',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

const goBack = () => {
  router.push('/app/settings')
}

// Chargement initial
onMounted(() => {
  fetchRepositories()
  fetchEnvironment()
})

// Watch pour les changements d'ID dans l'URL
watch(() => route.query.edit, (newId) => {
  if (newId) {
    fetchEnvironment()
  }
})

// Watch pour les changements de repository
watch(() => form.value.selectedRepository, (newValue) => {
  const repoValue = newValue?.value || newValue
  if (repoValue && typeof repoValue === 'string') {
    fetchBranches(repoValue)
  }
})
</script>