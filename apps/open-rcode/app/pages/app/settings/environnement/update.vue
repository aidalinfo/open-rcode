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
          <!-- Form Fields Component -->
          <EnvironmentFormFields
            v-model="form"
            :repositories="repositories"
            :loading-repositories="loadingRepositories"
            :is-editing="true"
            ref="formFieldsRef"
          />

          <!-- File Indexation Section -->
          <EnvironmentFileIndexationSection
            :environment-id="environmentId"
            class="mt-10"
          />

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
import type { SelectOption } from '~/types/environment'

const toast = useToast()
const route = useRoute()
const router = useRouter()

// Get environment ID from query params
const environmentId = computed(() => route.query.edit as string)

// Refs
const formFieldsRef = ref()

// Reactive states
const isLoadingEnvironment = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)
const isDeleting = ref(false)
const loadingRepositories = ref(false)

// Data
const repositories = ref<any[]>([])
const currentEnvironment = ref<any>(null)

// Form
const form = ref({
  selectedRepository: undefined as SelectOption | undefined,
  name: '',
  description: '',
  runtime: undefined as SelectOption | undefined,
  aiProvider: undefined as SelectOption | undefined,
  model: undefined as SelectOption | undefined,
  defaultBranch: undefined as SelectOption | undefined,
  environmentVariables: [] as Array<{ key: string; value: string; description?: string }>,
  configurationScript: ''
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

const fetchEnvironment = async () => {
  if (!environmentId.value) {
    loadError.value = 'Missing environment ID'
    isLoadingEnvironment.value = false
    return
  }

  try {
    isLoadingEnvironment.value = true
    
    // Load environment data first for immediate display
    const data = await $fetch(`/api/environments/${environmentId.value}`)
    currentEnvironment.value = data.environment
    
    // Fill form with existing data immediately (without repository/branch for now)
    form.value = {
      selectedRepository: undefined, // Will be set later
      name: data.environment.name || '',
      description: data.environment.description || '',
      runtime: {
        label: getRuntimeLabel(data.environment.runtime || 'node'),
        value: data.environment.runtime || 'node'
      },
      aiProvider: {
        label: getAiProviderLabel(data.environment.aiProvider || 'anthropic-api'),
        value: data.environment.aiProvider || 'anthropic-api'
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
      configurationScript: data.environment.configurationScript || ''
    }
    
    // Page is ready to display
    isLoadingEnvironment.value = false
    
    // Load repositories and branches in background
    loadRepositoriesAndBranches(data.environment)
    
  } catch (error) {
    if (import.meta.dev) console.error('Error loading environment:', error)
    loadError.value = 'Unable to load environment'
    isLoadingEnvironment.value = false
  }
}

const loadRepositoriesAndBranches = async (environment: any) => {
  try {
    // Load repositories in background
    await fetchRepositories()
    
    // Find and set the repository
    await nextTick()
    const foundRepo = repositories.value.find(repo => repo.full_name === environment.repositoryFullName)
    if (foundRepo) {
      form.value.selectedRepository = {
        label: foundRepo.full_name,
        value: foundRepo.full_name,
        description: foundRepo.description || 'No description'
      }
    }
    
    // Charger les branches en arrière-plan pour permettre à l'utilisateur de changer
    if (formFieldsRef.value && environment.repositoryFullName) {
      await formFieldsRef.value.fetchBranches(environment.repositoryFullName)
    }
    
  } catch (error) {
    if (import.meta.dev) console.error('Error loading repositories/branches:', error)
  }
}

const getRuntimeLabel = (runtime: string) => {
  const labels = {
    'node': 'Node.js',
    'python': 'Python',
    'bun': 'Bun',
    'java': 'Java',
    'swift': 'Swift',
    'ruby': 'Ruby',
    'rust': 'Rust',
    'go': 'Go',
    'php': 'PHP'
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

const getModelLabel = (model: string) => {
  const labels = {
    'sonnet': 'Claude Sonnet',
    'opus': 'Claude Opus'
  }
  return labels[model as keyof typeof labels] || model
}

const canSelectModel = computed(() => {
  const provider = form.value.aiProvider?.value
  return provider === 'anthropic-api' || provider === 'claude-oauth'
})

const submitForm = async () => {
  isSubmitting.value = true
  try {
    const selectedRepo = form.value.selectedRepository?.value
    
    if (!selectedRepo || typeof selectedRepo !== 'string') {
      toast.add({
        title: 'Error',
        description: 'Please select a repository',
        color: 'error'
      })
      return
    }
    
    const [organization, repository] = selectedRepo.split('/')
    const selectedRuntime = form.value.runtime?.value
    const selectedAiProvider = form.value.aiProvider?.value
    const selectedModel = canSelectModel.value ? form.value.model?.value : null
    const selectedDefaultBranch = form.value.defaultBranch?.value
    
    const payload = {
      organization,
      repository,
      name: form.value.name,
      description: form.value.description,
      runtime: selectedRuntime,
      aiProvider: selectedAiProvider,
      model: selectedModel,
      defaultBranch: selectedDefaultBranch,
      environmentVariables: form.value.environmentVariables.filter((v: any) => v.key && v.value),
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
    if (import.meta.dev) console.error('Error updating environment:', error)
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
    if (import.meta.dev) console.error('Error deleting environment:', error)
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
  fetchEnvironment() // Load environment first, then repositories in background
})

// Watch for ID changes in URL
watch(() => route.query.edit, (newId) => {
  if (newId) {
    fetchEnvironment()
  }
})
</script>