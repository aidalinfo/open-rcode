<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Manage your settings and configurations
        </p>
      </div>

      <!-- GitHub App Connection -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            GitHub App Connection
          </h2>
        </template>

        <div v-if="loadingGithubStatus" class="space-y-4">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-10 w-48" />
        </div>

        <div v-else class="space-y-4">
          <UAlert
            v-if="route.query.success === 'github_app_installed'"
            color="success"
            variant="soft"
            title="Success"
            description="Your GitHub App has been successfully installed!"
          />
          
          <UAlert
            v-if="route.query.error === 'github_app_auth_failed'"
            color="error"
            variant="soft"
            title="Error"
            description="Error connecting to GitHub App. Please try again."
          />

          <p class="text-gray-600 dark:text-gray-400">
            {{ hasGithubApp ? 'Modify your GitHub App permissions on your repositories.' : 'Install our GitHub App on your repositories to enable interaction with your projects.' }}
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
            {{ hasGithubApp ? 'Modify GitHub permissions' : 'Install GitHub App' }}
          </UButton>
        </div>
      </UCard>
      <!-- AI Tokens -->
      <UCard>
        <template #header>
          <div class="space-y-2">
            <h2 class="text-xl font-semibold">
              AI access
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              All your API keys are securely encrypted in our database
            </p>
          </div>
        </template>

        <div v-if="loadingAITokens" class="space-y-6">
          <!-- Anthropic API Key Skeleton -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <USkeleton class="h-5 w-5" />
              <USkeleton class="h-6 w-48" />
            </div>
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>
          
          <USeparator />
          
          <!-- Claude OAuth Token Skeleton -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <USkeleton class="h-5 w-5" />
              <USkeleton class="h-6 w-56" />
            </div>
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>
          
          <USeparator />
          
          <!-- Gemini API Key Skeleton -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <USkeleton class="h-5 w-5" />
              <USkeleton class="h-6 w-52" />
            </div>
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>
        </div>

        <div v-else class="space-y-6">
          <!-- API Key Anthropic -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cpu-chip" class="text-purple-500" />
              <h3 class="text-lg font-medium">Anthropic API Key</h3>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ hasAnthropicKey ? 'Your Anthropic API key is configured and securely encrypted.' : 'Configure your Anthropic API key to use Claude via API.' }}
            </p>

            <div v-if="!hasAnthropicKey" class="space-y-4">
              <UFormField label="Anthropic API Key" name="anthropicKey">
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
                    Save
                  </UButton>
                </div>
              </UFormField>
            </div>

            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-shield-check" class="text-green-500" />
                <span class="text-sm font-medium text-green-700 dark:text-green-400">
                  API Key configured
                </span>
              </div>
              <UButton
                @click="resetAnthropicKey"
                variant="ghost"
                size="sm"
                color="error"
              >
                <template #leading>
                  <UIcon name="i-heroicons-trash" />
                </template>
                Delete
              </UButton>
            </div>
          </div>

          <USeparator />

          <!-- Token OAuth Claude -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-identification" class="text-blue-500" />
              <h3 class="text-lg font-medium">Claude Code OAuth Token</h3>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ hasClaudeOAuth ? 'Your Claude Code OAuth token is configured and securely encrypted.' : 'Configure your OAuth token to use Claude Code CLI. (use claude setup-token command  to obtain the OAuth token.)' }}
            </p>

            <div v-if="!hasClaudeOAuth" class="space-y-4">
              <UFormField label="Claude Code OAuth Token" name="claudeOAuthToken">
                <div class="flex gap-2">
                  <UInput
                    v-model="claudeOAuthTokenInput"
                    type="password"
                    placeholder="oauth-token..."
                    size="lg"
                    class="flex-1"
                    :disabled="savingOAuthToken"
                  />
                  <UButton
                    @click="saveClaudeOAuthToken"
                    :loading="savingOAuthToken"
                    :disabled="!claudeOAuthTokenInput"
                    size="lg"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-key" />
                    </template>
                    Save
                  </UButton>
                </div>
              </UFormField>
            </div>

            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-shield-check" class="text-green-500" />
                <span class="text-sm font-medium text-green-700 dark:text-green-400">
                  OAuth Token configured
                </span>
              </div>
              <UButton
                @click="resetClaudeOAuthToken"
                variant="ghost"
                size="sm"
                color="error"
              >
                <template #leading>
                  <UIcon name="i-heroicons-trash" />
                </template>
                Delete
              </UButton>
            </div>
          </div>

          <USeparator />

          <!-- API Key Gemini -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
              <h3 class="text-lg font-medium">Google Gemini API Key</h3>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ hasGeminiKey ? 'Your Gemini API key is configured and securely encrypted.' : 'Configure your API key to use Google Gemini CLI.' }}
            </p>

            <div v-if="!hasGeminiKey" class="space-y-4">
              <UFormField label="Google Gemini API Key" name="geminiApiKey">
                <div class="flex gap-2">
                  <UInput
                    v-model="geminiApiKeyInput"
                    type="password"
                    placeholder="AIza..."
                    size="lg"
                    class="flex-1"
                    :disabled="savingGeminiKey"
                  />
                  <UButton
                    @click="saveGeminiApiKey"
                    :loading="savingGeminiKey"
                    :disabled="!geminiApiKeyInput"
                    size="lg"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-key" />
                    </template>
                    Save
                  </UButton>
                </div>
              </UFormField>
            </div>

            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-shield-check" class="text-green-500" />
                <span class="text-sm font-medium text-green-700 dark:text-green-400">
                  API Key configured
                </span>
              </div>
              <UButton
                @click="resetGeminiApiKey"
                variant="ghost"
                size="sm"
                color="error"
              >
                <template #leading>
                  <UIcon name="i-heroicons-trash" />
                </template>
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </UCard>


      <!-- Tableau des environnements -->
      <EnvironnementsTable 
        :environments="environments" 
        :loading="loading"
        :total="totalEnvironments"
        :page="currentPage"
        :limit="pageLimit"
        @refresh="fetchEnvironments"
        @update:page="handlePageChange"
      />
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
const hasClaudeOAuth = ref(false)
const hasGeminiKey = ref(false)
const loadingAITokens = ref(true)
const anthropicKeyInput = ref('')
const claudeOAuthTokenInput = ref('')
const geminiApiKeyInput = ref('')
const savingApiKey = ref(false)
const savingOAuthToken = ref(false)
const savingGeminiKey = ref(false)
const totalEnvironments = ref(0)
const currentPage = ref(1)
const pageLimit = ref(10)

// Méthodes
const fetchEnvironments = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/environments', {
      query: {
        page: currentPage.value,
        limit: pageLimit.value
      }
    })
    environments.value = data.environments || []
    totalEnvironments.value = data.total || 0
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching environments:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to fetch environments',
      color: 'error'
    })
  } finally {
    loading.value = false
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
    if (import.meta.dev) console.error('Error checking API key:', error)
  }
}

const checkClaudeOAuthToken = async () => {
  try {
    const data = await $fetch('/api/user/claude-oauth-token')
    hasClaudeOAuth.value = data.hasToken
  } catch (error) {
    if (import.meta.dev) console.error('Error checking OAuth token:', error)
  }
}

const checkGeminiApiKey = async () => {
  try {
    const data = await $fetch('/api/user/gemini-api-key')
    hasGeminiKey.value = data.hasApiKey
  } catch (error) {
    if (import.meta.dev) console.error('Error checking Gemini API key:', error)
  }
}

const checkAllAITokens = async () => {
  try {
    await Promise.all([
      checkAnthropicKey(),
      checkClaudeOAuthToken(), 
      checkGeminiApiKey()
    ])
  } finally {
    loadingAITokens.value = false
  }
}

const saveAnthropicKey = async () => {
  if (!anthropicKeyInput.value || !anthropicKeyInput.value.startsWith('sk-ant-')) {
    toast.add({
      title: 'Error',
      description: 'Please enter a valid Anthropic API key',
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
      title: 'Success',
      description: 'API key saved successfully',
      color: 'success'
    })
    
    hasAnthropicKey.value = true
    anthropicKeyInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Unable to save API key',
      color: 'error'
    })
  } finally {
    savingApiKey.value = false
  }
}

const resetAnthropicKey = async () => {
  if (confirm('Are you sure you want to delete your Anthropic API key?')) {
    try {
      await $fetch('/api/user/anthropic-key', {
        method: 'PUT',
        body: { anthropicKey: '' }
      })
      
      toast.add({
        title: 'Success',
        description: 'API key deleted successfully',
        color: 'success'
      })
      
      hasAnthropicKey.value = false
    } catch (error) {
      toast.add({
        title: 'Error',
        description: 'Unable to delete API key',
        color: 'error'
      })
    }
  }
}

const saveClaudeOAuthToken = async () => {
  if (!claudeOAuthTokenInput.value) {
    toast.add({
      title: 'Error',
      description: 'Please enter a valid OAuth token',
      color: 'error'
    })
    return
  }

  savingOAuthToken.value = true
  try {
    await $fetch('/api/user/claude-oauth-token', {
      method: 'PUT',
      body: { claudeOAuthToken: claudeOAuthTokenInput.value }
    })
    
    toast.add({
      title: 'Success',
      description: 'OAuth token saved successfully',
      color: 'success'
    })
    
    hasClaudeOAuth.value = true
    claudeOAuthTokenInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Unable to save OAuth token',
      color: 'error'
    })
  } finally {
    savingOAuthToken.value = false
  }
}

const resetClaudeOAuthToken = async () => {
  if (confirm('Are you sure you want to delete your Claude OAuth token?')) {
    try {
      await $fetch('/api/user/claude-oauth-token', {
        method: 'PUT',
        body: { claudeOAuthToken: '' }
      })
      
      toast.add({
        title: 'Success',
        description: 'OAuth token deleted successfully',
        color: 'success'
      })
      
      hasClaudeOAuth.value = false
    } catch (error) {
      toast.add({
        title: 'Error',
        description: 'Unable to delete OAuth token',
        color: 'error'
      })
    }
  }
}

const saveGeminiApiKey = async () => {
  if (!geminiApiKeyInput.value) {
    toast.add({
      title: 'Error',
      description: 'Please enter a valid Gemini API key',
      color: 'error'
    })
    return
  }

  savingGeminiKey.value = true
  try {
    await $fetch('/api/user/gemini-api-key', {
      method: 'PUT',
      body: { geminiApiKey: geminiApiKeyInput.value }
    })
    
    toast.add({
      title: 'Success',
      description: 'Gemini API key saved successfully',
      color: 'success'
    })
    
    hasGeminiKey.value = true
    geminiApiKeyInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Unable to save Gemini API key',
      color: 'error'
    })
  } finally {
    savingGeminiKey.value = false
  }
}

const resetGeminiApiKey = async () => {
  if (confirm('Are you sure you want to delete your Gemini API key?')) {
    try {
      await $fetch('/api/user/gemini-api-key', {
        method: 'PUT',
        body: { geminiApiKey: '' }
      })
      
      toast.add({
        title: 'Success',
        description: 'Gemini API key deleted successfully',
        color: 'success'
      })
      
      hasGeminiKey.value = false
    } catch (error) {
      toast.add({
        title: 'Error',
        description: 'Unable to delete Gemini API key',
        color: 'error'
      })
    }
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchEnvironments()
}

// Initial loading
onMounted(async () => {
  await Promise.all([
    fetchEnvironments(),
    checkGithubAppStatus(),
    checkAllAITokens()
  ])
})
</script>