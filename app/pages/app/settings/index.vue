<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Paramètres
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Gérez vos paramètres et configurations
        </p>
      </div>

      <!-- Tokens IA -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Tokens d'Intelligence Artificielle
          </h2>
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
              <h3 class="text-lg font-medium">Clé API Anthropic</h3>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ hasAnthropicKey ? 'Votre clé API Anthropic est configurée et chiffrée de manière sécurisée.' : 'Configurez votre clé API Anthropic pour utiliser Claude via API.' }}
            </p>

            <div v-if="!hasAnthropicKey" class="space-y-4">
              <UFormField label="Clé API Anthropic" name="anthropicKey">
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
                    Sauvegarder
                  </UButton>
                </div>
              </UFormField>
            </div>

            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-shield-check" class="text-green-500" />
                <span class="text-sm font-medium text-green-700 dark:text-green-400">
                  Clé API configurée
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
                Supprimer
              </UButton>
            </div>
          </div>

          <USeparator />

          <!-- Token OAuth Claude -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-identification" class="text-blue-500" />
              <h3 class="text-lg font-medium">Token OAuth Claude Code</h3>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ hasClaudeOAuth ? 'Votre token OAuth Claude Code est configuré et chiffré de manière sécurisée.' : 'Configurez votre token OAuth pour utiliser Claude Code CLI.' }}
            </p>

            <div v-if="!hasClaudeOAuth" class="space-y-4">
              <UFormField label="Token OAuth Claude Code" name="claudeOAuthToken">
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
                    Sauvegarder
                  </UButton>
                </div>
              </UFormField>
            </div>

            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-shield-check" class="text-green-500" />
                <span class="text-sm font-medium text-green-700 dark:text-green-400">
                  Token OAuth configuré
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
                Supprimer
              </UButton>
            </div>
          </div>

          <USeparator />

          <!-- API Key Gemini -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
              <h3 class="text-lg font-medium">Clé API Google Gemini</h3>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ hasGeminiKey ? 'Votre clé API Gemini est configurée et chiffrée de manière sécurisée.' : 'Configurez votre clé API pour utiliser Google Gemini CLI.' }}
            </p>

            <div v-if="!hasGeminiKey" class="space-y-4">
              <UFormField label="Clé API Google Gemini" name="geminiApiKey">
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
                    Sauvegarder
                  </UButton>
                </div>
              </UFormField>
            </div>

            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-shield-check" class="text-green-500" />
                <span class="text-sm font-medium text-green-700 dark:text-green-400">
                  Clé API configurée
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
                Supprimer
              </UButton>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Connexion GitHub App -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Connexion GitHub App
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
            title="Succès"
            description="Votre GitHub App a été installée avec succès !"
          />
          
          <UAlert
            v-if="route.query.error === 'github_app_auth_failed'"
            color="error"
            variant="soft"
            title="Erreur"
            description="Erreur lors de la connexion à GitHub App. Veuillez réessayer."
          />

          <p class="text-gray-600 dark:text-gray-400">
            {{ hasGithubApp ? 'Modifiez les droits de votre GitHub App sur vos repositories.' : 'Installez notre GitHub App sur vos repositories pour permettre l\'interaction avec vos projets.' }}
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
            {{ hasGithubApp ? 'Modifier les droits GitHub' : 'Installer GitHub App' }}
          </UButton>
        </div>
      </UCard>

      <!-- Tableau des environnements -->
      <EnvironnementsTable 
        :environments="environments" 
        :loading="loading"
        @refresh="fetchEnvironments"
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

// Méthodes
const fetchEnvironments = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/environments')
    environments.value = data.environments || []
  } catch (error) {
    console.error('Erreur lors de la récupération des environnements:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les environnements',
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
    console.error('Erreur lors de la vérification de la clé API:', error)
  }
}

const checkClaudeOAuthToken = async () => {
  try {
    const data = await $fetch('/api/user/claude-oauth-token')
    hasClaudeOAuth.value = data.hasToken
  } catch (error) {
    console.error('Erreur lors de la vérification du token OAuth:', error)
  }
}

const checkGeminiApiKey = async () => {
  try {
    const data = await $fetch('/api/user/gemini-api-key')
    hasGeminiKey.value = data.hasApiKey
  } catch (error) {
    console.error('Erreur lors de la vérification de la clé API Gemini:', error)
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
      title: 'Erreur',
      description: 'Veuillez entrer une clé API Anthropic valide',
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
      title: 'Succès',
      description: 'Clé API sauvegardée avec succès',
      color: 'success'
    })
    
    hasAnthropicKey.value = true
    anthropicKeyInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder la clé API',
      color: 'error'
    })
  } finally {
    savingApiKey.value = false
  }
}

const resetAnthropicKey = async () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer votre clé API Anthropic ?')) {
    try {
      await $fetch('/api/user/anthropic-key', {
        method: 'PUT',
        body: { anthropicKey: '' }
      })
      
      toast.add({
        title: 'Succès',
        description: 'Clé API supprimée avec succès',
        color: 'success'
      })
      
      hasAnthropicKey.value = false
    } catch (error) {
      toast.add({
        title: 'Erreur',
        description: 'Impossible de supprimer la clé API',
        color: 'error'
      })
    }
  }
}

const saveClaudeOAuthToken = async () => {
  if (!claudeOAuthTokenInput.value) {
    toast.add({
      title: 'Erreur',
      description: 'Veuillez entrer un token OAuth valide',
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
      title: 'Succès',
      description: 'Token OAuth sauvegardé avec succès',
      color: 'success'
    })
    
    hasClaudeOAuth.value = true
    claudeOAuthTokenInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder le token OAuth',
      color: 'error'
    })
  } finally {
    savingOAuthToken.value = false
  }
}

const resetClaudeOAuthToken = async () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer votre token OAuth Claude ?')) {
    try {
      await $fetch('/api/user/claude-oauth-token', {
        method: 'PUT',
        body: { claudeOAuthToken: '' }
      })
      
      toast.add({
        title: 'Succès',
        description: 'Token OAuth supprimé avec succès',
        color: 'success'
      })
      
      hasClaudeOAuth.value = false
    } catch (error) {
      toast.add({
        title: 'Erreur',
        description: 'Impossible de supprimer le token OAuth',
        color: 'error'
      })
    }
  }
}

const saveGeminiApiKey = async () => {
  if (!geminiApiKeyInput.value) {
    toast.add({
      title: 'Erreur',
      description: 'Veuillez entrer une clé API Gemini valide',
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
      title: 'Succès',
      description: 'Clé API Gemini sauvegardée avec succès',
      color: 'success'
    })
    
    hasGeminiKey.value = true
    geminiApiKeyInput.value = ''
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder la clé API Gemini',
      color: 'error'
    })
  } finally {
    savingGeminiKey.value = false
  }
}

const resetGeminiApiKey = async () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer votre clé API Gemini ?')) {
    try {
      await $fetch('/api/user/gemini-api-key', {
        method: 'PUT',
        body: { geminiApiKey: '' }
      })
      
      toast.add({
        title: 'Succès',
        description: 'Clé API Gemini supprimée avec succès',
        color: 'success'
      })
      
      hasGeminiKey.value = false
    } catch (error) {
      toast.add({
        title: 'Erreur',
        description: 'Impossible de supprimer la clé API Gemini',
        color: 'error'
      })
    }
  }
}


// Chargement initial
onMounted(async () => {
  await Promise.all([
    fetchEnvironments(),
    checkGithubAppStatus(),
    checkAllAITokens()
  ])
})
</script>