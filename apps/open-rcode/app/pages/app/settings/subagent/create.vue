<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          SubAgents
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Create AI subagents to assist with specific tasks
        </p>
      </div>

      <!-- Creation form -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Create a new SubAgent
          </h2>
        </template>

        <UForm
          :state="form"
          class="space-y-6"
          @submit="submitForm"
        >
          <!-- Form Fields Component -->
          <SubagentSubAgentFormFields
            v-model="form"
            :is-editing="false"
          />

          <!-- Action buttons -->
          <div class="flex justify-end gap-3 mt-6">
            <UButton
              to="/app/settings/subagent"
              variant="ghost"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
            >
              Create SubAgent
            </UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const router = useRouter()

// Reactive states
const isSubmitting = ref(false)

// Form
const form = ref({
  name: '',
  description: '',
  prompt: '',
  isPublic: false
})

// Methods
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

    await $fetch('/api/sub-agents', {
      method: 'POST',
      body: payload
    })

    toast.add({
      title: 'Success',
      description: 'SubAgent created successfully',
      color: 'success'
    })

    router.push('/app/settings/subagent')
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Unable to create SubAgent',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>
