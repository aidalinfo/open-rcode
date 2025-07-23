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
const loadingBranches = ref(false)

// Données
const repositories = ref<any[]>([])
const environments = ref<any[]>([])
const branches = ref<any[]>([])

// Formulaire
const form = ref({
  selectedRepository: { label: 'Please select a repository', value: '', description: '' },
  name: '',
  description: '',
  runtime: { label: 'Node.js', value: 'node' },
  aiProvider: 'anthropic-api',
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
    value: branch.name
  }))
})

const selectedRepository = computed(() => {
  return form.value.selectedRepository?.value || form.value.selectedRepository
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
    
    // Sélectionner automatiquement la branche 'main' ou 'master' par défaut
    const defaultBranch = branches.value.find((branch: any) => 
      branch.name === 'main' || branch.name === 'master'
    )
    
    if (defaultBranch) {
      form.value.defaultBranch = {
        label: defaultBranch.name,
        value: defaultBranch.name
      }
    } else if (branches.value.length > 0) {
      form.value.defaultBranch = {
        label: branches.value[0].name,
        value: branches.value[0].name
      }
    }
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

// Watcher pour détecter les changements de repository
watch(() => form.value.selectedRepository, (newValue) => {
  const repoValue = newValue?.value || newValue
  if (repoValue && !form.value.name) {
    form.value.name = 'Production'
  }
  
  // Récupérer les branches du repository sélectionné
  if (repoValue && typeof repoValue === 'string') {
    fetchBranches(repoValue)
  } else {
    branches.value = []
    form.value.defaultBranch = { label: 'main', value: 'main' }
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
    const selectedRuntime = typeof form.value.runtime === 'object' ? form.value.runtime.value : form.value.runtime
    const selectedAiProvider = typeof form.value.aiProvider === 'object' ? form.value.aiProvider.value : form.value.aiProvider
    
    console.log('FORM VALUES:')
    console.log('- form.value:', form.value)
    console.log('- selectedRuntime:', selectedRuntime, typeof selectedRuntime)
    console.log('- selectedAiProvider:', selectedAiProvider, typeof selectedAiProvider)
    console.log('- form.value.aiProvider:', form.value.aiProvider)
    
    const selectedDefaultBranch = typeof form.value.defaultBranch === 'object' ? form.value.defaultBranch.value : form.value.defaultBranch
    
    const payload = {
      organization,
      repository,
      name: form.value.name,
      description: form.value.description,
      runtime: selectedRuntime,
      aiProvider: selectedAiProvider,
      defaultBranch: selectedDefaultBranch,
      environmentVariables: form.value.environmentVariables.filter(v => v.key && v.value),
      configurationScript: form.value.configurationScript
    }

    await $fetch('/api/environments', {
      method: 'POST',
      body: payload
    })
    
    toast.add({
      title: 'Succès',
      description: 'Environnement créé avec succès',
      color: 'success'
    })

    resetForm()
    
    // Rediriger vers la page des paramètres
    await navigateTo('/app/settings')
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


const resetForm = () => {
  form.value = {
    selectedRepository: { label: 'Please select a repository', value: '', description: '' },
    name: '',
    description: '',
    runtime: { label: 'Node.js', value: 'node' },
    aiProvider: 'anthropic-api',
    defaultBranch: { label: 'main', value: 'main' },
    environmentVariables: [],
    configurationScript: ''
  }
  branches.value = []
}


// Chargement initial
onMounted(() => {
  fetchRepositories()
})
</script>