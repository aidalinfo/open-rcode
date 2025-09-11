<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">MCP</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Create a new MCP server entry</p>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Create MCP</h2>
        </template>

        <UForm :state="form" :validate="validate" class="space-y-6" @submit="submitForm" @error="onError">
          <McpFormFields v-model="form" />

          <div class="flex justify-end gap-3 mt-6">
            <UButton to="/app/settings/mcp" variant="ghost">Cancel</UButton>
            <UButton type="submit" :loading="isSubmitting">Create</UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </UContainer>
  
</template>

<script setup lang="ts">
import type { FormError, FormErrorEvent } from '@nuxt/ui'
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const router = useRouter()

const isSubmitting = ref(false)

const form = ref({
  name: '',
  type: undefined as any,
  url: '',
  command: '',
  args: [] as string[],
  description: ''
})

// Nuxt UI client-side validation
const validate = (state: any): FormError[] => {
  const errors: FormError[] = []

  if (!state.name || !String(state.name).trim()) {
    errors.push({ name: 'name', message: 'Name is required' })
  }

  const t = state.type?.value
  if (!t) {
    errors.push({ name: 'type', message: 'Type is required' })
  } else if (t !== 'sse' && t !== 'stdio') {
    errors.push({ name: 'type', message: 'Type must be SSE or STDIO' })
  }

  if (t === 'sse') {
    const url = (state.url || '').trim()
    if (!url) {
      errors.push({ name: 'url', message: 'URL is required for SSE' })
    } else {
      try {
        // Basic URL validation
        // eslint-disable-next-line no-new
        new URL(url)
      } catch {
        errors.push({ name: 'url', message: 'URL is invalid' })
      }
    }
  }

  if (t === 'stdio') {
    if (!state.command || !String(state.command).trim()) {
      errors.push({ name: 'command', message: 'Command is required for STDIO' })
    }
  }

  return errors
}

// Focus the first field with an error
const onError = (event: FormErrorEvent) => {
  const id = event?.errors?.[0]?.id
  if (id) {
    const el = document.getElementById(id)
    el?.focus()
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const submitForm = async () => {
  isSubmitting.value = true
  try {
    const type = form.value.type?.value

    const payload: any = {
      name: form.value.name.trim(),
      type,
      url: form.value.url?.trim() || undefined,
      command: form.value.command?.trim() || undefined,
      args: form.value.args || [],
      description: form.value.description?.trim() || undefined
    }

    await $fetch('/api/mcp', { method: 'POST', body: payload })

    toast.add({ title: 'Success', description: 'MCP created successfully', color: 'success' })
    router.push('/app/settings/mcp')
  } catch (error) {
    toast.add({ title: 'Error', description: 'Unable to create MCP', color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}
</script>
