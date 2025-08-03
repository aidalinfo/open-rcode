<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Environments
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Manage your deployment environments
        </p>
      </div>

      <!-- Creation form -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Create a new environment
          </h2>
        </template>

        <UForm :state="form" @submit="submitForm" class="space-y-12">
          <!-- Form Fields Component -->
          <EnvironmentFormFields
            v-model="form"
            :repositories="repositories"
            :loading-repositories="loadingRepositories"
            :is-editing="false"
          />

          <!-- File Indexation Section (only shown after creation) -->
          <EnvironmentFileIndexationSection
            v-if="createdEnvironmentId"
            :environment-id="createdEnvironmentId"
            class="mt-10"
          />

          <!-- Action buttons -->
          <div class="flex justify-end gap-3 mt-12">
            <UButton
              type="submit"
              :loading="isSubmitting"
            >
              Create
            </UButton>
          </div>
        </UForm>
      </UCard>

    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { SelectOption } from '~/types/environment'

const toast = useToast()
const router = useRouter()

// Reactive states
const isSubmitting = ref(false)
const loadingRepositories = ref(false)
const createdEnvironmentId = ref<string | null>(null)

// Data
const repositories = ref<any[]>([])

// Form
const form = ref({
  selectedRepository: { label: 'Please select a repository', value: '', description: '' } as SelectOption,
  name: '',
  description: '',
  runtime: { label: 'Node.js', value: 'node' } as SelectOption,
  aiProvider: 'anthropic-api' as SelectOption | string,
  model: 'sonnet' as SelectOption | string,
  defaultBranch: { label: 'main', value: 'main' } as SelectOption,
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

const canSelectModel = computed(() => {
  const provider = typeof form.value.aiProvider === 'object' ? form.value.aiProvider.value : form.value.aiProvider
  return provider === 'anthropic-api' || provider === 'claude-oauth'
})

const submitForm = async () => {
  isSubmitting.value = true
  try {
    const selectedRepo = form.value.selectedRepository?.value || form.value.selectedRepository
    if (import.meta.dev) console.log('selectedRepository:', selectedRepo, typeof selectedRepo)
    
    if (!selectedRepo || typeof selectedRepo !== 'string') {
      toast.add({
        title: 'Error',
        description: 'Please select a repository',
        color: 'error'
      })
      return
    }
    
    const [organization, repository] = selectedRepo.split('/')
    const selectedRuntime = typeof form.value.runtime === 'object' ? form.value.runtime.value : form.value.runtime
    const selectedAiProvider = typeof form.value.aiProvider === 'object' ? form.value.aiProvider.value : form.value.aiProvider
    const selectedModel = canSelectModel.value ? (typeof form.value.model === 'object' ? form.value.model.value : form.value.model) : null
    
    if (import.meta.dev) {
      console.log('FORM VALUES:')
      console.log('- form.value:', form.value)
      console.log('- selectedRuntime:', selectedRuntime, typeof selectedRuntime)
      console.log('- selectedAiProvider:', selectedAiProvider, typeof selectedAiProvider)
      console.log('- selectedModel:', selectedModel, typeof selectedModel)
      console.log('- form.value.aiProvider:', form.value.aiProvider)
    }
    
    const selectedDefaultBranch = typeof form.value.defaultBranch === 'object' ? form.value.defaultBranch.value : form.value.defaultBranch
    
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

    const response = await $fetch('/api/environments', {
      method: 'POST',
      body: payload
    })
    
    // Store the created environment ID for indexation
    createdEnvironmentId.value = response.environment._id
    
    toast.add({
      title: 'Success',
      description: 'Environment created successfully',
      color: 'success'
    })

    // Reset form but keep showing the indexation section
    resetForm()
    
    // Optionally redirect after a delay to allow indexation
    setTimeout(() => {
      if (!createdEnvironmentId.value || !document.querySelector('.indexing')) {
        router.push('/app/settings')
      }
    }, 3000)
    
  } catch (error) {
    if (import.meta.dev) console.error('Error submitting form:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to save environment',
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
    model: 'sonnet',
    defaultBranch: { label: 'main', value: 'main' },
    environmentVariables: [],
    configurationScript: ''
  }
}

// Initial loading
onMounted(() => {
  fetchRepositories()
})
</script>