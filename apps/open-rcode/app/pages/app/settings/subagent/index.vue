<template>
  <UContainer class="mt-4">
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            SubAgents
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Manage your AI subagents and their configurations
          </p>
        </div>
      </div>

      <SubAgentsTable 
        :subagents="subagents" 
        :loading="loading"
        :total="total"
        :page="page"
        :limit="limit"
        @refresh="fetchSubAgents"
        @update:page="handlePageChange"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { data: subagentsResponse, pending: loading, refresh: fetchSubAgents } = await useFetch('/api/subagents', {
  server: false
})

const subagents = computed(() => subagentsResponse.value?.subagents || [])
const total = computed(() => subagentsResponse.value?.total || 0)

// Pagination
const page = ref(1)
const limit = ref(10)

const handlePageChange = (newPage: number) => {
  page.value = newPage
  fetchSubAgents()
}
</script>