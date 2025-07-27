<script setup lang="ts">
interface Stat {
  title: string
  icon: string
  value: string | number
  variation?: number
  formatter?: (value: number) => string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  })
}

const { data: statsData, pending, error } = await useFetch('/api/dashboard/stats')

const stats = computed<Stat[]>(() => {
  if (!statsData.value?.stats) return []
  
  const { taskCount, totalCostUSD, pullRequestCount, environmentCount } = statsData.value.stats
  
  return [
    {
      title: 'Tasks',
      icon: 'i-lucide-list-checks',
      value: taskCount || 0
    },
    {
      title: 'Total Cost',
      icon: 'i-lucide-circle-dollar-sign',
      value: formatCurrency(totalCostUSD || 0)
    },
    {
      title: 'Pull Requests',
      icon: 'i-lucide-git-pull-request',
      value: pullRequestCount || 0
    },
    {
      title: 'Environments',
      icon: 'i-lucide-server',
      value: environmentCount || 0
    }
  ]
})
</script>

<template>
  <div class="container mx-auto p-6">
    <div v-if="pending" class="flex justify-center items-center h-32">
      <div class="text-muted-foreground">Loading stats...</div>
    </div>
    
    <div v-else-if="error" class="text-red-500">
      Error loading stats: {{ error.message }}
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="(stat, index) in stats"
        :key="index"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {{ stat.title }}
            </p>
            <div class="mt-2 flex items-baseline">
              <span class="text-2xl font-semibold text-gray-900 dark:text-white">
                {{ stat.value }}
              </span>
            </div>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <Icon :name="stat.icon" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>