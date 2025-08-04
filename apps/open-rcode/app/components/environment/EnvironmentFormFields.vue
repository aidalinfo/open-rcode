<template>
  <div class="space-y-12">
    <!-- Repository selection -->
    <UFormField label="Repository" name="repository" required class="mt-8">
      <USelectMenu
        v-model="selectedRepository"
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
        v-model="name"
        placeholder="ex: Production, Staging, Development"
        size="lg"
        class="w-full"
      />
    </UFormField>

    <!-- Description -->
    <UFormField label="Description" name="description" class="mt-10">
      <UTextarea
        v-model="description"
        placeholder="Environment description"
        :rows="3"
        size="lg"
        class="w-full"
      />
    </UFormField>

    <!-- Runtime -->
    <UFormField label="Runtime" name="runtime" required class="mt-10">
      <USelectMenu
        v-model="runtime"
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
        v-model="aiProvider"
        :items="aiProviderOptions"
        placeholder="Select an AI provider"
        value-attribute="value"
        option-attribute="label"
        size="lg"
        class="w-full"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          {{ getAiProviderDescription(aiProviderValue || '') }}
        </p>
      </template>
    </UFormField>

    <!-- AI Model -->
    <UFormField v-if="canSelectModel" label="Artificial Intelligence Model" name="model" required class="mt-10">
      <USelectMenu
        v-model="model"
        :items="modelOptions"
        placeholder="Select a model"
        value-attribute="value"
        option-attribute="label"
        size="lg"
        class="w-full"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          {{ getModelDescription(modelValue || '') }}
        </p>
      </template>
    </UFormField>

    <!-- Default branch -->
    <UFormField label="Default branch" name="defaultBranch" required class="mt-10">
      <USelectMenu
        v-model="defaultBranch"
        :items="branchOptions"
        placeholder="Select a branch"
        :loading="loadingBranches"
        size="lg"
        class="w-full"
        :disabled="false"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          This branch will be used for repository cloning and pull request creation.
        </p>
      </template>
    </UFormField>

    <!-- Environment variables -->
    <EnvironmentVariablesEditor
      v-model="environmentVariables"
      class="mt-10"
    />

    <!-- Configuration script -->
    <UFormField label="Configuration script" name="configurationScript" class="mt-10">
      <UTextarea
        v-model="configurationScript"
        placeholder="e.g.: npm install && npm run build"
        :rows="4"
        size="lg"
        class="w-full"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from '~/types/environment'

interface Props {
  modelValue: {
    selectedRepository: SelectOption | undefined
    name: string
    description: string
    runtime: SelectOption | undefined
    aiProvider: SelectOption | undefined
    model: SelectOption | undefined
    defaultBranch: SelectOption | undefined
    environmentVariables: Array<{ key: string; value: string; description?: string }>
    configurationScript: string
  }
  repositories?: any[]
  loadingRepositories?: boolean
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  repositories: () => [],
  loadingRepositories: false,
  isEditing: false
})

const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
}>()

const toast = useToast()

// Internal refs
const branches = ref<any[]>([])
const loadingBranches = ref(false)

// Runtime options
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

// AI Provider options
const aiProviderOptions: SelectOption[] = [
  { label: 'API Anthropic (Claude)', value: 'anthropic-api' },
  { label: 'OAuth Claude Code CLI', value: 'claude-oauth' },
  { label: 'Google Gemini CLI', value: 'gemini-cli' }
]

// Model options
const modelOptions: SelectOption[] = [
  { label: 'Claude Sonnet', value: 'sonnet' },
  { label: 'Claude Opus', value: 'opus' }
]

// Simple v-model computed properties
const selectedRepository = computed({
  get: () => props.modelValue.selectedRepository,
  set: (value) => emit('update:modelValue', { ...props.modelValue, selectedRepository: value })
})

const name = computed({
  get: () => props.modelValue.name,
  set: (value) => emit('update:modelValue', { ...props.modelValue, name: value })
})

const description = computed({
  get: () => props.modelValue.description,
  set: (value) => emit('update:modelValue', { ...props.modelValue, description: value })
})

const runtime = computed({
  get: () => props.modelValue.runtime,
  set: (value) => emit('update:modelValue', { ...props.modelValue, runtime: value })
})

const aiProvider = computed({
  get: () => props.modelValue.aiProvider,
  set: (value) => emit('update:modelValue', { ...props.modelValue, aiProvider: value })
})

const model = computed({
  get: () => props.modelValue.model,
  set: (value) => emit('update:modelValue', { ...props.modelValue, model: value })
})

const defaultBranch = computed({
  get: () => props.modelValue.defaultBranch,
  set: (value) => emit('update:modelValue', { ...props.modelValue, defaultBranch: value })
})

const environmentVariables = computed({
  get: () => props.modelValue.environmentVariables,
  set: (value) => emit('update:modelValue', { ...props.modelValue, environmentVariables: value })
})

const configurationScript = computed({
  get: () => props.modelValue.configurationScript,
  set: (value) => emit('update:modelValue', { ...props.modelValue, configurationScript: value })
})

// Helper computed properties
const selectedRepositoryValue = computed(() => {
  return selectedRepository.value?.value
})

const aiProviderValue = computed(() => {
  return aiProvider.value?.value
})

const modelValue = computed(() => {
  return model.value?.value
})

const canSelectModel = computed(() => {
  const provider = aiProviderValue.value
  return provider === 'anthropic-api' || provider === 'claude-oauth'
})

const repositoryOptions = computed((): SelectOption[] => {
  return props.repositories.map((repo: any) => ({
    label: repo.full_name,
    value: repo.full_name,
    description: repo.description || 'No description'
  }))
})

const branchOptions = computed((): SelectOption[] => {
  const options: SelectOption[] = []
  const selectedValue = props.modelValue.defaultBranch
  
  // Toujours inclure la valeur actuelle en premier
  if (selectedValue && selectedValue.value) {
    options.push(selectedValue)
  }
  
  // Ajouter les autres branches chargées depuis l'API
  branches.value.forEach((branch: any) => {
    // Ne pas dupliquer la branche déjà sélectionnée
    if (!selectedValue || branch.name !== selectedValue.value) {
      options.push({
        label: branch.name,
        value: branch.name,
        description: branch.protected ? 'Protected branch' : undefined
      })
    }
  })
  
  return options
})

// Methods
const fetchBranches = async (repositoryFullName: string) => {
  if (!repositoryFullName) return
  
  loadingBranches.value = true
  try {
    const [owner, repo] = repositoryFullName.split('/')
    const data = await $fetch(`/api/repositories/${owner}/${repo}/branches`)
    branches.value = data.branches
    
    // En mode édition, ne jamais modifier automatiquement la branche sélectionnée
    // Les branches chargées serviront juste d'options supplémentaires
    if (!props.isEditing) {
      // Automatically select 'main' or 'master' branch by default pour les nouveaux environnements
      const foundDefaultBranch = branches.value.find((branch: any) => 
        branch.name === 'main' || branch.name === 'master'
      )
      
      if (foundDefaultBranch) {
        emit('update:modelValue', {
          ...props.modelValue,
          defaultBranch: {
            label: foundDefaultBranch.name,
            value: foundDefaultBranch.name
          }
        })
      } else if (branches.value.length > 0) {
        emit('update:modelValue', {
          ...props.modelValue,
          defaultBranch: {
            label: branches.value[0].name,
            value: branches.value[0].name
          }
        })
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

const getAiProviderDescription = (provider: string) => {
  const descriptions: Record<string, string> = {
    'anthropic-api': 'Uses your Anthropic API key to call Claude directly via API.',
    'claude-oauth': 'Uses your OAuth token for Claude Code CLI (recommended for advanced features).',
    'gemini-cli': 'Uses your Google API key to call Gemini via CLI.'
  }
  return descriptions[provider] || ''
}

const getModelDescription = (model: string) => {
  const descriptions: Record<string, string> = {
    'sonnet': 'Claude Sonnet - Balanced model between performance and speed (recommended).',
    'opus': 'Claude Opus - Most powerful model for complex tasks.'
  }
  return descriptions[model] || ''
}

// Watch for repository changes
watch(() => selectedRepositoryValue.value, (newValue) => {
  if (newValue && !props.modelValue.name && !props.isEditing) {
    // Auto-fill name for new environments
    emit('update:modelValue', {
      ...props.modelValue,
      name: 'Production'
    })
  }
  
  // Fetch branches for selected repository
  if (newValue) {
    fetchBranches(newValue)
  } else {
    branches.value = []
    if (!props.isEditing) {
      emit('update:modelValue', {
        ...props.modelValue,
        defaultBranch: { label: 'main', value: 'main' }
      })
    }
  }
})

// Expose methods for parent components
defineExpose({
  fetchBranches,
  branches
})
</script>