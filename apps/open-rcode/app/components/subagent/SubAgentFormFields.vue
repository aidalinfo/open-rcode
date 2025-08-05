<template>
  <div class="space-y-6">
    <!-- SubAgent name -->
    <UFormField label="Name" name="name" required>
      <UInput
        v-model="name"
        placeholder="e.g., Code Reviewer, Test Generator, Documentation Writer"
        size="lg"
        class="w-full"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          A descriptive name for your SubAgent
        </p>
      </template>
    </UFormField>

    <!-- Description -->
    <UFormField label="Description" name="description">
      <UTextarea
        v-model="description"
        placeholder="Describe what this SubAgent does and when it should be used"
        :rows="3"
        size="lg"
        class="w-full"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          Optional description to help understand the SubAgent's purpose
        </p>
      </template>
    </UFormField>

    <!-- Prompt -->
    <UFormField label="Prompt" name="prompt" required>
      <UTextarea
        v-model="prompt"
        placeholder="Enter the system prompt that defines how this SubAgent should behave..."
        :rows="10"
        size="lg"
        class="w-full font-mono text-sm"
      />
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          The system prompt that will be used to configure the AI behavior for this SubAgent
        </p>
      </template>
    </UFormField>

    <!-- Visibility -->
    <UFormField label="Visibility" name="isPublic">
      <div class="flex items-center gap-3">
        <UToggle
          v-model="isPublic"
          size="lg"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ isPublic ? 'Public' : 'Private' }} - {{ isPublic ? 'Other users can use this SubAgent' : 'Only you can use this SubAgent' }}
        </span>
      </div>
      <template #help>
        <p class="text-sm text-gray-500 mt-2">
          Public SubAgents can be used by all users of the platform
        </p>
      </template>
    </UFormField>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: {
    name: string
    description: string
    prompt: string
    isPublic: boolean
  }
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false
})

const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
}>()

// Simple v-model computed properties
const name = computed({
  get: () => props.modelValue.name,
  set: (value) => emit('update:modelValue', { ...props.modelValue, name: value })
})

const description = computed({
  get: () => props.modelValue.description,
  set: (value) => emit('update:modelValue', { ...props.modelValue, description: value })
})

const prompt = computed({
  get: () => props.modelValue.prompt,
  set: (value) => emit('update:modelValue', { ...props.modelValue, prompt: value })
})

const isPublic = computed({
  get: () => props.modelValue.isPublic,
  set: (value) => emit('update:modelValue', { ...props.modelValue, isPublic: value })
})
</script>