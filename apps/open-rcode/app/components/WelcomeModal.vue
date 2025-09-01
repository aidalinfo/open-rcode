<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-sparkles"
              class="w-6 h-6 text-primary"
            />
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Welcome to open-rcode! 🎉
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Let's get you started with AI-powered development
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-6">
          <div class="text-center">
            <p class="text-gray-600 dark:text-gray-300">
              To begin using open-rcode, you'll need to complete a few setup steps:
            </p>
          </div>

          <div class="space-y-4">
            <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-medium text-blue-600 dark:text-blue-400">1</span>
              </div>
              <div class="space-y-1">
                <h4 class="font-medium text-gray-900 dark:text-white">
                  Configure AI Provider
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                  Go to <strong>Settings</strong> and add your Claude or Gemini API credentials to enable AI-powered development tasks.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="w-6 h-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-medium text-green-600 dark:text-green-400">2</span>
              </div>
              <div class="space-y-1">
                <h4 class="font-medium text-gray-900 dark:text-white">
                  Connect GitHub Repositories
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                  Install and authorize our GitHub App on your repositories to enable automatic Pull Request creation.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="w-6 h-6 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-medium text-purple-600 dark:text-purple-400">3</span>
              </div>
              <div class="space-y-1">
                <h4 class="font-medium text-gray-900 dark:text-white">
                  Create Your First Environment
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                  Set up your first development environment to start running AI-powered tasks on your projects.
                </p>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <UIcon
                name="i-lucide-info"
                class="w-4 h-4 text-blue-600 dark:text-blue-400"
              />
              <span class="text-sm font-medium text-blue-900 dark:text-blue-100">Pro Tip</span>
            </div>
            <p class="text-sm text-blue-800 dark:text-blue-200">
              Once configured, you'll be able to run development tasks from anywhere, including your mobile device!
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between items-center">
            <UButton
              variant="ghost"
              color="neutral"
              @click="closeModal"
            >
              Skip for now
            </UButton>
            <UButton
              color="primary"
              @click="goToSettings"
            >
              Get Started
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const closeModal = () => {
  isOpen.value = false
}

const goToSettings = () => {
  closeModal()
  navigateTo('/app/settings')
}
</script>
