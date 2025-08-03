<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Environment variables
      </h3>
      <UButton
        @click="addVariable"
        variant="outline"
        size="sm"
      >
        <template #leading>
          <UIcon name="i-heroicons-plus" />
        </template>
        Add
      </UButton>
    </div>
    
    <div v-if="variables.length > 0" class="space-y-6 mt-6">
      <div
        v-for="(variable, index) in variables"
        :key="index"
        class="flex items-center gap-4"
      >
        <div class="flex-1">
          <UInput
            v-model="variable.key"
            placeholder="Key (e.g.: NODE_ENV)"
            size="lg"
            class="w-full"
          />
        </div>
        <div class="flex-1">
          <UInput
            v-model="variable.value"
            placeholder="Value (e.g.: production)"
            size="lg"
            class="w-full"
          />
        </div>
        <UButton
          @click="removeVariable(index)"
          color="error"
          variant="ghost"
          size="lg"
          class="shrink-0"
        >
          <UIcon name="i-heroicons-trash" />
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface EnvironmentVariable {
  key: string
  value: string
  description?: string
}

const props = defineProps<{
  modelValue: EnvironmentVariable[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EnvironmentVariable[]]
}>()

const variables = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const addVariable = () => {
  variables.value = [...variables.value, { key: '', value: '', description: '' }]
}

const removeVariable = (index: number) => {
  variables.value = variables.value.filter((_, i) => i !== index)
}
</script>