<template>
  <UContainer>
    <div class="min-h-screen flex items-center justify-center">
      <UCard class="w-full max-w-md">
        <template #header>
          <div class="text-center">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              Sign In
            </h2>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Use your GitHub account to sign in
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            title="Login Error"
            description="An error occurred during login. Please try again."
          />

          <UButton
            @click="loginWithGitHub"
            variant="outline"
            size="lg"
            block
            :loading="isLoading"
          >
            <template #leading>
              <UIcon name="i-simple-icons-github" class="w-5 h-5" />
            </template>
            Sign in with GitHub
          </UButton>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'no-connected',
})
const route = useRoute()
const isLoading = ref(false)
const error = computed(() => route.query.error === 'auth_failed')

const loginWithGitHub = () => {
  isLoading.value = true
  window.location.href = '/api/auth/github'
}
</script>