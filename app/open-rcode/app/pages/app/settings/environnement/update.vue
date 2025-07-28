<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Edit environment
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Modify your environment configuration
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

      <!-- Modification form -->
      <UCard v-if="!isLoadingEnvironment && !loadError">
        <template #header>
          <h2 class="text-xl font-semibold">
            Environment configuration
          </h2>
        </template>

        <UForm :state="form" @submit="submitForm" class="space-y-12">
          <!-- Repository selection -->
          <UFormField label="Repository" name="repository" required class="mt-8">
            <USelectMenu
              v-model="form.selectedRepository"
              :items="repositoryOptions"
              placeholder="Select a repository"
              :loading="loadingRepositories"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Environment name -->
          <UFormField label="Name" name="name" required class="mt-10">
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
              placeholder="Environment description"
              :rows="3"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Runtime -->
          <UFormField label="Runtime" name="runtime" required class="mt-10">
            <USelectMenu
              v-model="form.runtime"
              :items="runtimeOptions"
              placeholder="Select a runtime"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- AI Provider -->
          <UFormField label="Artificial Intelligence Provider" name="aiProvider" required class="mt-10">
            <USelectMenu
              v-model="form.aiProvider"
              :items="aiProviderOptions"
              placeholder="Select an AI provider"
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

          <!-- AI Model -->
          <UFormField v-if="canSelectModel" label="Artificial Intelligence Model" name="model" required class="mt-10">
            <USelectMenu
              v-model="form.model"
              :items="modelOptions"
              placeholder="Select a model"
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

          <!-- Default branch -->
          <UFormField label="Default branch" name="defaultBranch" required class="mt-10">
            <USelectMenu
              v-model="form.defaultBranch"
              :items="branchOptions"
              placeholder="Select a branch"
              :loading="loadingBranches"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              class="w-full"
              :disabled="!selectedRepository"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                This branch will be used for repository cloning and pull request creation.
              </p>
            </template>
          </UFormField>

          <!-- Environment variables -->
          <div class="space-y-6 mt-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                Environment variables
              </h3>
              <UButton
                @click="addVariable"
                variant="outline"
                size="sm"
              >
                <template #leading>
                  <UIcon name="i-heroicons-plus" />
                </template>
                Add
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
                    placeholder="Key (e.g.: NODE_ENV)"
                    size="lg"
                    class="w-full"
                  />
                </div>
                <div class="flex-1">
                  <UInput
                    v-model="variable.value"
                    placeholder="Value (e.g.: production)"
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

          <!-- Configuration script -->
          <UFormField label="Configuration script" name="configurationScript" class="mt-10">
            <UTextarea
              v-model="form.configurationScript"
              placeholder="e.g.: npm install && npm run build"
              :rows="4"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Action buttons -->
          <div class="flex justify-between gap-3 mt-12">
            <UButton
              @click="goBack"
              variant="ghost"
            >
              <template #leading>
                <UIcon name="i-heroicons-arrow-left" />
              </template>
              Back
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
                Delete
              </UButton>
              <UButton
                type="submit"
                :loading="isSubmitting"
              >
                <template #leading>
                  <UIcon name="i-heroicons-check" />
                </template>
                Save
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

// Reactive states
const isLoadingEnvironment = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)
const isDeleting = ref(false)
const loadingRepositories = ref(false)
const loadingBranches = ref(false)

// Data
const repositories = ref<any[]>([])
const branches = ref<any[]>([])
const currentEnvironment = ref<any>(null)

// Form
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
    description: repo.description || 'No description'
  }))
})

const branchOptions = computed(() => {
  return branches.value.map((branch: any) => ({
    label: branch.name,
    value: branch.name,
    description: branch.protected ? 'Protected branch' : ''
  }))
})

const selectedRepository = computed(() => {
  return form.value.selectedRepository?.value || form.value.selectedRepository
})

const canSelectModel = computed(() => {
  const provider = form.value.aiProvider?.value || form.value.aiProvider
  return provider === 'anthropic-api' || provider === 'claude-oauth'
})

// Methods
const fetchRepositories = async () => {
  loadingRepositories.value = true
  try {
    const data = await $fetch('/api/repositories')
    repositories.value = data.repositories
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Unable to fetch repositories',
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
    if (import.meta.dev) console.error('Error fetching branches:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to fetch repository branches',
      color: 'error'
    })
    branches.value = []
  } finally {
    loadingBranches.value = false
  }
}

const fetchEnvironment = async () => {
  if (!environmentId.value) {
    loadError.value = 'Missing environment ID'
    isLoadingEnvironment.value = false
    return
  }

  try {
    isLoadingEnvironment.value = true
    const data = await $fetch(`/api/environments/${environmentId.value}`)
    currentEnvironment.value = data.environment
    
    if (import.meta.dev) {
      console.log('ENVIRONMENT DATA RECEIVED:')
      console.log('- Full data:', data)
      console.log('- environment:', data.environment)
      console.log('- aiProvider:', data.environment.aiProvider, typeof data.environment.aiProvider)
      console.log('- model:', data.environment.model, typeof data.environment.model)
      console.log('- runtime:', data.environment.runtime, typeof data.environment.runtime)
      console.log('- environmentVariables:', data.environment.environmentVariables)
    }
    
    // Fetch repository branches
    await fetchBranches(data.environment.repositoryFullName)
    
    // Fill form with existing data
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
    console.error('Error loading environment:', error)
    loadError.value = 'Unable to load environment'
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
    'anthropic-api': 'Uses your Anthropic API key to call Claude directly via API.',
    'claude-oauth': 'Uses your OAuth token for Claude Code CLI (recommended for advanced features).',
    'gemini-cli': 'Uses your Google API key to call Gemini via CLI.'
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
    'sonnet': 'Claude Sonnet - Balanced model between performance and speed (recommended).',
    'opus': 'Claude Opus - Most powerful model for complex tasks.'
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
        title: 'Error',
        description: 'Please select a repository',
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
      title: 'Success',
      description: 'Environment updated successfully',
      color: 'success'
    })
    
    // Redirect to settings page
    router.push('/app/settings')
    
  } catch (error) {
    console.error('Error updating environment:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to update environment',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const deleteEnvironment = async () => {
  if (!confirm('Are you sure you want to delete this environment? This action is irreversible.')) {
    return
  }

  isDeleting.value = true
  try {
    await $fetch(`/api/environments/${environmentId.value}`, {
      method: 'DELETE'
    })
    
    toast.add({
      title: 'Success',
      description: 'Environment deleted successfully',
      color: 'success'
    })
    
    // Redirect to settings page
    router.push('/app/settings')
    
  } catch (error) {
    console.error('Error deleting environment:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to delete environment',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

const goBack = () => {
  router.push('/app/settings')
}

// Initial loading
onMounted(() => {
  fetchRepositories()
  fetchEnvironment()
})

// Watch for ID changes in URL
watch(() => route.query.edit, (newId) => {
  if (newId) {
    fetchEnvironment()
  }
})

// Watch for repository changes
watch(() => form.value.selectedRepository, (newValue) => {
  const repoValue = newValue?.value || newValue
  if (repoValue && typeof repoValue === 'string') {
    fetchBranches(repoValue)
  }
})
</script>