<template>
  <UContainer>
    <div class="py-8 space-y-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Application
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Bienvenue dans votre espace personnel
        </p>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Connexion GitHub App
          </h2>
        </template>

        <div class="space-y-4">
          <UAlert
            v-if="route.query.success === 'github_app_installed'"
            color="green"
            variant="soft"
            title="Succès"
            description="Votre GitHub App a été installée avec succès !"
          />
          
          <UAlert
            v-if="route.query.error === 'github_app_auth_failed'"
            color="red"
            variant="soft"
            title="Erreur"
            description="Erreur lors de la connexion à GitHub App. Veuillez réessayer."
          />

          <p class="text-gray-600 dark:text-gray-400">
            Installez notre GitHub App sur vos repositories pour permettre l'interaction avec vos projets.
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
            Installer GitHub App
          </UButton>
        </div>
      </UCard>

      <UCard v-if="repositories.length > 0">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">
              Mes Repositories
            </h2>
            <UButton
              @click="fetchRepositories"
              variant="ghost"
              size="sm"
              :loading="isLoading"
            >
              <template #leading>
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
              </template>
              Actualiser
            </UButton>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="repo in repositories"
            :key="repo.id"
            class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ repo.name }}
                </h3>
                <UBadge v-if="repo.private" color="yellow" size="xs">
                  Privé
                </UBadge>
              </div>
              <p v-if="repo.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ repo.description }}
              </p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span v-if="repo.language" class="flex items-center gap-1">
                  <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                  {{ repo.language }}
                </span>
                <span>{{ repo.default_branch }}</span>
              </div>
            </div>
            <UButton
              :to="repo.html_url"
              target="_blank"
              variant="ghost"
              size="sm"
            >
              <template #leading>
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
              </template>
              Voir
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard v-else-if="!isLoading">
        <div class="text-center py-8">
          <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Aucun repository trouvé
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Installez d'abord la GitHub App pour voir vos repositories.
          </p>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const isInstalling = ref(false)
const isLoading = ref(false)
const repositories = ref([])

const installGitHubApp = () => {
  isInstalling.value = true
  window.location.href = '/api/auth/github-app'
}

const fetchRepositories = async () => {
  isLoading.value = true
  try {
    const data = await $fetch('/api/repositories')
    repositories.value = data.repositories
  } catch (error) {
    console.error('Erreur lors de la récupération des repositories:', error)
  } finally {
    isLoading.value = false
  }
}

// Charger les repositories au montage
onMounted(() => {
  fetchRepositories()
})
</script>