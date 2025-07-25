<template>
  <UCard class="mt-6">
    <template #header>
      <div class="flex items-center justify-between">
        <USkeleton class="h-6 w-32" />
        <USkeleton class="h-5 w-5" />
      </div>
    </template>

    <!-- Table header skeleton -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <div class="grid grid-cols-6 gap-4 p-4">
        <USkeleton class="h-4 w-16" />
        <USkeleton class="h-4 w-12" />
        <USkeleton class="h-4 w-20" />
        <USkeleton class="h-4 w-16" />
        <USkeleton class="h-4 w-20" />
        <USkeleton class="h-4 w-12" />
      </div>
    </div>

    <!-- Table rows skeleton -->
    <div class="divide-y divide-gray-200 dark:divide-gray-700">
      <div v-for="n in 5" :key="n" class="grid grid-cols-6 gap-4 p-4">
        <div class="space-y-1">
          <USkeleton class="h-4 w-24" />
        </div>
        <div class="space-y-1">
          <USkeleton class="h-5 w-16 rounded-full" />
        </div>
        <div class="space-y-1">
          <USkeleton class="h-4 w-20" />
        </div>
        <div class="space-y-1">
          <USkeleton class="h-4 w-16" />
        </div>
        <div class="space-y-1">
          <USkeleton class="h-4 w-12" />
        </div>
        <div class="space-y-1">
          <USkeleton class="h-6 w-12 rounded" />
        </div>
      </div>
    </div>
  </UCard>
</template>