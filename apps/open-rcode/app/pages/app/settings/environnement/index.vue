<template>
  <UContainer class="mt-4">
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Environments
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Manage your development environments and configurations
          </p>
        </div>
      </div>

      <EnvironnementsTable 
        :environments="environments" 
        :loading="loading"
        :total="total"
        :page="page"
        :limit="limit"
        @refresh="fetchEnvironments"
        @update:page="handlePageChange"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { data: environmentsResponse, pending: loading, refresh: fetchEnvironments } = await useFetch('/api/environments', {
  server: false
})

const environments = computed(() => environmentsResponse.value?.environments || [])
const total = computed(() => environmentsResponse.value?.total || 0)

// Pagination
const page = ref(1)
const limit = ref(10)

const handlePageChange = (newPage: number) => {
  page.value = newPage
  fetchEnvironments()
}
</script>