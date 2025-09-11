<template>
  <div class="space-y-10">
    <!-- Name -->
    <UFormField label="Name" name="name" required class="mt-4">
      <UInput v-model="name" placeholder="e.g., Nuxt Content, Local Tool" size="lg" class="w-full" />
    </UFormField>

    <!-- Type -->
    <UFormField label="Type" name="type" required class="mt-6">
      <USelectMenu
        v-model="type"
        :items="typeOptions"
        value-attribute="value"
        option-attribute="label"
        size="lg"
        class="w-full"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">Choose how this MCP server is accessed.</p>
      </template>
    </UFormField>

    <!-- URL (for SSE) -->
    <UFormField v-if="typeValue === 'sse'" label="SSE URL" name="url" required class="mt-6">
      <UInput v-model="url" placeholder="https://mcp.example.com/sse" size="lg" class="w-full" />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">Endpoint to connect via Server-Sent Events.</p>
      </template>
    </UFormField>

    <!-- Command (for stdio) -->
    <UFormField v-if="typeValue === 'stdio'" label="Command" name="command" required class="mt-6">
      <UInput v-model="command" placeholder="npx" size="lg" class="w-full" />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">Executable command for stdio MCP servers.</p>
      </template>
    </UFormField>

    <!-- Args (for stdio) -->
    <UFormField v-if="typeValue === 'stdio'" label="Arguments" name="args" class="mt-6">
      <UInput v-model="argsInput" placeholder="-y @mastra/mcp-docs-server@latest" size="lg" class="w-full" />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">Space-separated list; stored as an array.</p>
      </template>
    </UFormField>

    <!-- Description -->
    <UFormField label="Description" name="description" class="mt-6">
      <UTextarea v-model="description" :rows="3" size="lg" class="w-full" />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
interface SelectOption { label: string; value: string }

interface Props {
  modelValue: {
    name: string
    type: SelectOption | undefined
    url?: string
    command?: string
    args: string[]
    description?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: Props['modelValue']] }>()

const typeOptions: SelectOption[] = [
  { label: 'SSE', value: 'sse' },
  { label: 'STDIO', value: 'stdio' }
]

const name = computed({
  get: () => props.modelValue.name,
  set: v => emit('update:modelValue', { ...props.modelValue, name: v })
})

const type = computed({
  get: () => props.modelValue.type,
  set: v => emit('update:modelValue', { ...props.modelValue, type: v })
})

const url = computed({
  get: () => props.modelValue.url,
  set: v => emit('update:modelValue', { ...props.modelValue, url: v })
})

const command = computed({
  get: () => props.modelValue.command,
  set: v => emit('update:modelValue', { ...props.modelValue, command: v })
})

const args = computed({
  get: () => props.modelValue.args,
  set: v => emit('update:modelValue', { ...props.modelValue, args: v })
})

const description = computed({
  get: () => props.modelValue.description,
  set: v => emit('update:modelValue', { ...props.modelValue, description: v })
})

const typeValue = computed(() => type.value?.value)
const argsInput = computed({
  get: () => (args.value || []).join(' '),
  set: (v: string) => args.value = (v || '').trim() ? v.trim().split(/\s+/) : []
})
</script>
