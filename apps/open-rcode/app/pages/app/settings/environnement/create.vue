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
            {{ isEditing ? 'Edit environment' : 'Create a new environment' }}
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
              size="lg"
              class="w-full"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                {{ getAiProviderDescription(form.aiProvider?.value || form.aiProvider) }}
              </p>
            </template>
          </UFormField>

          <!-- AI Model -->
          <UFormField v-if="canSelectModel" label="Artificial Intelligence Model" name="model" required class="mt-10">
            <USelectMenu
              v-model="form.model"
              :items="modelOptions"
              placeholder="Select a model"
              size="lg"
              class="w-full"
            />
            <template #help>
              <p class="text-sm text-gray-500 mt-2">
                {{ getModelDescription(form.model?.value || form.model) }}
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
          <div class="flex justify-end gap-3 mt-12">
            <UButton
              v-if="isEditing"
              @click="cancelEdit"
              variant="ghost"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
            >
              {{ isEditing ? 'Edit' : 'Create' }}
            </UButton>
          </div>
        </UForm>
      </UCard>

    </div>
  </UContainer>
</template>

<script setup lang="ts">
const toast = useToast()

// Reactive states
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const isSubmitting = ref(false)
const loadingRepositories = ref(false)
const loadingEnvironments = ref(false)
const loadingBranches = ref(false)

// Data
const repositories = ref<any[]>([])
const environments = ref<any[]>([])
const branches = ref<any[]>([])

// Form
const form = ref({
  selectedRepository: { label: 'Please select a repository', value: '', description: '' },
  name: '',
  description: '',
  runtime: { label: 'Node.js', value: 'node' },
  aiProvider: 'anthropic-api',
  model: 'sonnet',
  defaultBranch: { label: 'main', value: 'main' },
  environmentVariables: [] as Array<{ key: string; value: string; description: string }>,
  configurationScript: ''
})

// Options
const runtimeOptions = [
  { label: 'Node.js', value: 'node' },
  { label: 'Python', value: 'python' },
  { label: 'Bun', value: 'bun' },
  { label: 'Java', value: 'java' },
  { label: 'Swift', value: 'swift' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Rust', value: 'rust' },
  { label: 'Go', value: 'go' },
  { label: 'PHP', value: 'php' }
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
    value: branch.name
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
    
    // Automatically select 'main' or 'master' branch by default
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

// Watcher to detect repository changes
watch(() => form.value.selectedRepository, (newValue) => {
  const repoValue = newValue?.value || newValue
  if (repoValue && !form.value.name) {
    form.value.name = 'Production'
  }
  
  // Fetch branches for selected repository
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
    'anthropic-api': 'Uses your Anthropic API key to call Claude directly via API.',
    'claude-oauth': 'Uses your OAuth token for Claude Code CLI (recommended for advanced features).',
    'gemini-cli': 'Uses your Google API key to call Gemini via CLI.'
  }
  return descriptions[provider as keyof typeof descriptions] || ''
}

const getModelDescription = (model: string) => {
  const descriptions = {
    'sonnet': 'Claude Sonnet - Balanced model between performance and speed (recommended).',
    'opus': 'Claude Opus - Most powerful model for complex tasks.'
  }
  return descriptions[model as keyof typeof descriptions] || ''
}


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

    await $fetch('/api/environments', {
      method: 'POST',
      body: payload
    })
    
    toast.add({
      title: 'Success',
      description: 'Environment created successfully',
      color: 'success'
    })

    resetForm()
    
    // Redirect to settings page
    await navigateTo('/app/settings')
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
  branches.value = []
}


// Initial loading
onMounted(() => {
  fetchRepositories()
})
</script>