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

          <!-- File Indexation Section -->
          <div class="space-y-6 mt-10">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                  File Indexation
                </h3>
                <p class="text-sm text-gray-500 mt-1">
                  Index all files in the repository for faster access
                </p>
              </div>
              <div class="flex items-center gap-4">
                <div v-if="indexInfo" class="text-sm text-gray-500">
                  <span v-if="indexInfo.indexed">
                    {{ (indexInfo.totalFiles ?? indexInfo.paths?.length) || 0 }} files indexed
                    <time :datetime="indexInfo.indexedAt || undefined" class="ml-2">
                      ({{ formatDate(indexInfo.indexedAt || '') }})
                    </time>
                  </span>
                  <span v-else>
                    Not indexed
                  </span>
                </div>
                
                <UButton
                  @click="indexFiles"
                  variant="outline"
                  size="sm"
                  :loading="isIndexing"
                  :disabled="!currentEnvironment"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-magnifying-glass" />
                  </template>
                  {{ indexInfo?.indexed ? 'Re-index' : 'Index' }} Files
                </UButton>
              </div>
            </div>
            
            <!-- Indexed Files Tree -->
            <div v-if="indexInfo?.indexed" class="mt-6">
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">
                Indexed Files ({{ indexedFiles.length }})
              </h4>
              <div class="rounded-lg p-4 max-h-80 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
                <UTree v-if="indexTree.length" :items="indexTree" />
                <div v-else class="text-center py-8 text-gray-500">
                  No files indexed yet
                </div>
              </div>
            </div>
          </div>

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
const isIndexing = ref(false)
interface IndexInfo {
  indexed: boolean
  paths: string[]
  indexedAt: string | null
  totalFiles?: number
}

const indexInfo = ref<IndexInfo | null>(null)
const indexedFiles = ref<string[]>([])

// Tree structure for file index
const indexTree = computed(() => {
  if (!indexedFiles.value.length) return []
  return buildFileTree(indexedFiles.value)
})

// Data
const repositories = ref<any[]>([])
const branches = ref<any[]>([])
const currentEnvironment = ref<any>(null)

// Form
interface SelectOption {
  label: string
  value: string
  description?: string
}

const form = ref({
  selectedRepository: { label: '', value: '', description: '' } as SelectOption,
  name: '',
  description: '',
  runtime: { label: 'Node.js', value: 'node' } as SelectOption,
  aiProvider: { label: 'API Anthropic (Claude)', value: 'anthropic-api' } as SelectOption,
  model: { label: 'Claude Sonnet', value: 'sonnet' } as SelectOption,
  defaultBranch: { label: 'main', value: 'main' } as SelectOption,
  environmentVariables: [] as Array<{ key: string; value: string; description: string }>,
  configurationScript: ''
})

// Options
const runtimeOptions: SelectOption[] = [
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

const aiProviderOptions: SelectOption[] = [
  { label: 'API Anthropic (Claude)', value: 'anthropic-api' },
  { label: 'OAuth Claude Code CLI', value: 'claude-oauth' },
  { label: 'Google Gemini CLI', value: 'gemini-cli' }
]

const modelOptions: SelectOption[] = [
  { label: 'Claude Sonnet', value: 'sonnet' },
  { label: 'Claude Opus', value: 'opus' }
]

const repositoryOptions = computed((): SelectOption[] => {
  return repositories.value.map((repo: any) => ({
    label: repo.full_name,
    value: repo.full_name,
    description: repo.description || 'No description'
  }))
})

const branchOptions = computed((): SelectOption[] => {
  return branches.value.map((branch: any) => ({
    label: branch.name,
    value: branch.name,
    description: branch.protected ? 'Protected branch' : 'Regular branch'
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
    
    // Load environment data first for immediate display
    const data = await $fetch(`/api/environments/${environmentId.value}`)
    currentEnvironment.value = data.environment
    
    // Fill form with existing data immediately (without repository/branch for now)
    form.value = {
      selectedRepository: { label: '', value: '', description: '' }, // Will be set later
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
      defaultBranch: { label: 'main', value: 'main' }, // Will be set later
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
    
    // Find and set the exact repository object from repositoryOptions
    await nextTick()
    const foundRepoOption = repositoryOptions.value.find(option => option.value === environment.repositoryFullName)
    if (foundRepoOption) {
      form.value.selectedRepository = foundRepoOption
    }
    
    // Load branches
    await fetchBranches(environment.repositoryFullName)
    
    // Find and set the exact branch object from branchOptions
    await nextTick()
    const defaultBranchName = environment.defaultBranch || 'main'
    const foundBranchOption = branchOptions.value.find(option => option.value === defaultBranchName)
    
    if (foundBranchOption) {
      form.value.defaultBranch = foundBranchOption
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

const fetchIndexInfo = async () => {
  if (!environmentId.value) return
  
  try {
    const data = await $fetch(`/api/environments/${environmentId.value}/file-index`)
    indexInfo.value = {
      indexed: data.indexed,
      paths: data.paths || [],
      indexedAt: data.indexedAt,
      totalFiles: (data as any).totalFiles ?? data.paths?.length ?? 0
    }
    indexedFiles.value = data.paths || []
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching index info:', error)
  }
}

const indexFiles = async () => {
  isIndexing.value = true
  try {
    await $fetch(`/api/environments/${environmentId.value}/file-index`, {
      method: 'POST'
    })
    
    toast.add({
      title: 'Indexing started',
      description: 'File indexing has been started in the background',
      color: 'success'
    })
    
    // Poll for completion
    let attempts = 0
    const maxAttempts = 30 // 30 seconds
    const pollInterval = setInterval(async () => {
      attempts++
      await fetchIndexInfo()
      
      if (indexInfo.value?.indexed || attempts >= maxAttempts) {
        clearInterval(pollInterval)
        isIndexing.value = false
        
        if (indexInfo.value?.indexed) {
          toast.add({
            title: 'Indexing completed',
            description: `Successfully indexed ${indexInfo.value?.totalFiles ?? indexInfo.value?.paths.length ?? 0} files`,
            color: 'success'
          })
        }
      }
    }, 1000)
    
  } catch (error) {
    if (import.meta.dev) console.error('Error starting indexation:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to start file indexation',
      color: 'error'
    })
    isIndexing.value = false
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Build tree structure from file paths
const buildFileTree = (paths: string[]) => {
  const tree: any[] = []
  const pathMap = new Map()

  paths.forEach(path => {
    const parts = path.split('/')
    let current = tree
    let currentPath = ''

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = index === parts.length - 1
      
      let existing = current.find(item => item.label === part)
      
      if (!existing) {
        existing = {
          label: part,
          ...(isFile ? { icon: getFileIcon(part) } : { children: [], defaultExpanded: index < 2 })
        }
        current.push(existing)
      }
      
      if (!isFile) {
        current = existing.children
      }
    })
  })

  return tree
}

// Get icon based on file extension
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  const iconMap: Record<string, string> = {
    // Web files
    'vue': 'i-vscode-icons-file-type-vue',
    'js': 'i-vscode-icons-file-type-js',
    'ts': 'i-vscode-icons-file-type-typescript',
    'jsx': 'i-vscode-icons-file-type-reactjs',
    'tsx': 'i-vscode-icons-file-type-reactts',
    'html': 'i-vscode-icons-file-type-html',
    'css': 'i-vscode-icons-file-type-css',
    'scss': 'i-vscode-icons-file-type-scss',
    'sass': 'i-vscode-icons-file-type-sass',
    'less': 'i-vscode-icons-file-type-less',
    
    // Config files
    'json': 'i-vscode-icons-file-type-json',
    'yaml': 'i-vscode-icons-file-type-yaml',
    'yml': 'i-vscode-icons-file-type-yaml',
    'toml': 'i-vscode-icons-file-type-toml',
    'env': 'i-vscode-icons-file-type-dotenv',
    
    // Build/Package
    'dockerfile': 'i-vscode-icons-file-type-docker',
    'lock': 'i-vscode-icons-file-type-npm',
    
    // Documentation
    'md': 'i-vscode-icons-file-type-markdown',
    'mdx': 'i-vscode-icons-file-type-mdx',
    'txt': 'i-vscode-icons-file-type-text',
    'pdf': 'i-vscode-icons-file-type-pdf',
    
    // Programming languages
    'py': 'i-vscode-icons-file-type-python',
    'rb': 'i-vscode-icons-file-type-ruby',
    'php': 'i-vscode-icons-file-type-php',
    'go': 'i-vscode-icons-file-type-go',
    'rs': 'i-vscode-icons-file-type-rust',
    'java': 'i-vscode-icons-file-type-java',
    'kt': 'i-vscode-icons-file-type-kotlin',
    'swift': 'i-vscode-icons-file-type-swift',
    'c': 'i-vscode-icons-file-type-c',
    'cpp': 'i-vscode-icons-file-type-cpp',
    'cs': 'i-vscode-icons-file-type-csharp',
    
    // Images
    'png': 'i-vscode-icons-file-type-image',
    'jpg': 'i-vscode-icons-file-type-image',
    'jpeg': 'i-vscode-icons-file-type-image',
    'gif': 'i-vscode-icons-file-type-image',
    'svg': 'i-vscode-icons-file-type-svg',
    'webp': 'i-vscode-icons-file-type-image',
    
    // Archives
    'zip': 'i-vscode-icons-file-type-zip',
    'tar': 'i-vscode-icons-file-type-zip',
    'gz': 'i-vscode-icons-file-type-zip',
  }
  
  // Special file names
  if (filename.toLowerCase() === 'package.json') return 'i-vscode-icons-file-type-node'
  if (filename.toLowerCase() === 'dockerfile') return 'i-vscode-icons-file-type-docker'
  if (filename.toLowerCase().startsWith('readme')) return 'i-vscode-icons-file-type-markdown'
  if (filename.toLowerCase().includes('license')) return 'i-vscode-icons-file-type-license'
  
  return iconMap[ext || ''] || 'i-heroicons-document'
}

// Initial loading
onMounted(() => {
  fetchEnvironment() // Load environment first, then repositories in background
  fetchIndexInfo()
})

// Watch for ID changes in URL
watch(() => route.query.edit, (newId) => {
  if (newId) {
    fetchEnvironment()
    fetchIndexInfo()
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