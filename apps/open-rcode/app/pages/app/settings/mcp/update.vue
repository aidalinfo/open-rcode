<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Edit MCP</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Modify your MCP configuration</p>
      </div>

      <div v-if="isLoading" class="flex justify-center py-8">
        <UIcon name="i-lucide-refresh-cw" class="w-8 h-8 animate-spin text-gray-500" />
      </div>

      <UAlert v-if="loadError" color="error" variant="soft" :title="loadError" class="mb-6" />

      <UCard v-if="!isLoading && !loadError">
        <template #header>
          <h2 class="text-xl font-semibold">MCP configuration</h2>
        </template>

        <UForm :state="form" :validate="validate" class="space-y-6" @submit="submitForm" @error="onError">
          <McpFormFields v-model="form" />

          <div class="flex justify-between gap-3 mt-6">
            <UButton variant="ghost" @click="goBack">
              <template #leading>
                <UIcon name="i-lucide-arrow-left" />
              </template>
              Back
            </UButton>

            <div class="flex gap-3">
              <UButton color="error" variant="outline" :loading="isDeleting" @click="deleteMcp">
                <template #leading>
                  <UIcon name="i-lucide-trash-2" />
                </template>
                Delete
              </UButton>
              <UButton type="submit" :loading="isSubmitting">
                <template #leading>
                  <UIcon name="i-lucide-check" />
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
import type { FormError, FormErrorEvent } from '@nuxt/ui'
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const route = useRoute()
const router = useRouter()

const mcpId = computed(() => route.query.edit as string)

const isLoading = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)
const isDeleting = ref(false)

const form = ref({
  name: '',
  type: undefined as any,
  url: '',
  command: '',
  args: [] as string[],
  description: ''
})

// Nuxt UI client-side validation (mirrors create page)
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

const onError = (event: FormErrorEvent) => {
  const id = event?.errors?.[0]?.id
  if (id) {
    const el = document.getElementById(id)
    el?.focus()
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const fetchMcp = async () => {
  if (!mcpId.value) {
    loadError.value = 'Missing MCP ID'
    isLoading.value = false
    return
  }
  try {
    isLoading.value = true
    const data: any = await $fetch(`/api/mcp/${mcpId.value}`)
    form.value = {
      name: data.name || '',
      type: data.type ? { label: String(data.type).toUpperCase(), value: data.type } : undefined,
      url: data.url || '',
      command: data.command || '',
      args: Array.isArray(data.args) ? data.args : [],
      description: data.description || ''
    }
    isLoading.value = false
  } catch (e) {
    if (import.meta.dev) console.error('Error loading MCP:', e)
    loadError.value = 'Unable to load MCP'
    isLoading.value = false
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
    await $fetch(`/api/mcp/${mcpId.value}`, { method: 'PUT', body: payload })
    toast.add({ title: 'Success', description: 'MCP updated successfully', color: 'success' })
    router.push('/app/settings/mcp')
  } catch (e) {
    if (import.meta.dev) console.error('Error updating MCP:', e)
    toast.add({ title: 'Error', description: 'Unable to update MCP', color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}

const deleteMcp = async () => {
  if (!confirm('Are you sure you want to delete this MCP?')) return
  isDeleting.value = true
  try {
    await $fetch(`/api/mcp/${mcpId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'MCP deleted successfully', color: 'success' })
    router.push('/app/settings/mcp')
  } catch (e) {
    if (import.meta.dev) console.error('Error deleting MCP:', e)
    toast.add({ title: 'Error', description: 'Unable to delete MCP', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const goBack = () => router.push('/app/settings/mcp')

onMounted(fetchMcp)
watch(() => route.query.edit, (v) => { if (v) fetchMcp() })
</script>
