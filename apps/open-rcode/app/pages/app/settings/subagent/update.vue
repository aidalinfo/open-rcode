<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Edit SubAgent
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Modify your SubAgent configuration
        </p>
      </div>

      <!-- Loading state -->
      <div v-if="isLoadingSubAgent" class="flex justify-center py-8">
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
      <UCard v-if="!isLoadingSubAgent && !loadError">
        <template #header>
          <h2 class="text-xl font-semibold">
            SubAgent configuration
          </h2>
        </template>

        <UForm :state="form" @submit="submitForm" class="space-y-6">
          <!-- Form Fields Component -->
          <SubAgentFormFields
            v-model="form"
            :is-editing="true"
          />

          <!-- Action buttons -->
          <div class="flex justify-between gap-3 mt-6">
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
                @click="deleteSubAgent"
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
                Save Changes
              </UButton>
            </div>
          </div>
        </UForm>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const route = useRoute()
const router = useRouter()

// Get SubAgent ID from query params
const subagentId = computed(() => route.query.edit as string)

// Reactive states
const isLoadingSubAgent = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)
const isDeleting = ref(false)

// Data
const currentSubAgent = ref<any>(null)

// Form
const form = ref({
  name: '',
  description: '',
  prompt: '',
  isPublic: false
})

// Methods
const fetchSubAgent = async () => {
  if (!subagentId.value) {
    loadError.value = 'Missing SubAgent ID'
    isLoadingSubAgent.value = false
    return
  }

  try {
    isLoadingSubAgent.value = true
    
    // Load SubAgent data
    const data = await $fetch(`/api/subagents/${subagentId.value}`)
    currentSubAgent.value = data.subagent
    
    // Fill form with existing data
    form.value = {
      name: data.subagent.name || '',
      description: data.subagent.description || '',
      prompt: data.subagent.prompt || '',
      isPublic: data.subagent.isPublic || false
    }
    
    isLoadingSubAgent.value = false
    
  } catch (error) {
    if (import.meta.dev) console.error('Error loading SubAgent:', error)
    loadError.value = 'Unable to load SubAgent'
    isLoadingSubAgent.value = false
  }
}

const submitForm = async () => {
  isSubmitting.value = true
  try {
    if (!form.value.name.trim()) {
      toast.add({
        title: 'Error',
        description: 'Name is required',
        color: 'error'
      })
      return
    }

    if (!form.value.prompt.trim()) {
      toast.add({
        title: 'Error',
        description: 'Prompt is required',
        color: 'error'
      })
      return
    }

    const payload = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      prompt: form.value.prompt.trim(),
      isPublic: form.value.isPublic
    }

    await $fetch(`/api/subagents/${subagentId.value}`, {
      method: 'PUT',
      body: payload
    })
    
    toast.add({
      title: 'Success',
      description: 'SubAgent updated successfully',
      color: 'success'
    })
    
    // Redirect to SubAgents list
    router.push('/app/settings/subagent')
    
  } catch (error) {
    if (import.meta.dev) console.error('Error updating SubAgent:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to update SubAgent',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const deleteSubAgent = async () => {
  if (!confirm('Are you sure you want to delete this SubAgent? This action is irreversible.')) {
    return
  }

  isDeleting.value = true
  try {
    await $fetch(`/api/subagents/${subagentId.value}`, {
      method: 'DELETE'
    })
    
    toast.add({
      title: 'Success',
      description: 'SubAgent deleted successfully',
      color: 'success'
    })
    
    // Redirect to SubAgents list
    router.push('/app/settings/subagent')
    
  } catch (error) {
    if (import.meta.dev) console.error('Error deleting SubAgent:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to delete SubAgent',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

const goBack = () => {
  router.push('/app/settings/subagent')
}

// Initial loading
onMounted(() => {
  fetchSubAgent()
})

// Watch for ID changes in URL
watch(() => route.query.edit, (newId) => {
  if (newId) {
    fetchSubAgent()
  }
})
</script>