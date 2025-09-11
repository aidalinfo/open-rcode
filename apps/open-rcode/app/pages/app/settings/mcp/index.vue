<template>
  <UContainer class="mt-4">
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">MCP Servers</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">Manage your Model Context Protocol servers</p>
        </div>
      </div>

      <McpsTable
        :mcps="mcps"
        :loading="loading"
        :total="total"
        :page="page"
        :limit="limit"
        @refresh="fetchMcps"
        @update:page="handlePageChange"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()

const mcps = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = ref(10)

const fetchMcps = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/mcp', { query: { page: page.value, limit: limit.value } })
    mcps.value = data.mcps || []
    total.value = data.pagination?.total || 0
  } catch (e) {
    if (import.meta.dev) console.error('Error fetching MCPs:', e)
    toast.add({ title: 'Error', description: 'Unable to fetch MCPs', color: 'error' })
  } finally {
    loading.value = false
  }
}

const handlePageChange = (newPage: number) => { page.value = newPage; fetchMcps() }

onMounted(fetchMcps)
</script>

