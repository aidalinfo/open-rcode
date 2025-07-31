<template>
  <div class="py-8 space-y-6">
    <!-- Chat prompt skeleton -->
    <div class="space-y-4">
      <USkeleton class="h-32 w-full" />
      <div class="flex justify-between">
        <USkeleton class="h-10 w-32" />
        <USkeleton class="h-10 w-24" />
      </div>
    </div>

    <!-- Environment/TaskTable skeleton -->
    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center justify-between">
          <USkeleton class="h-6 w-32" />
          <USkeleton class="h-5 w-5" />
        </div>
      </template>

      <!-- Table skeleton -->
      <div class="space-y-4">
        <!-- Table header -->
        <div class="grid grid-cols-6 gap-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <USkeleton class="h-4 w-16" />
          <USkeleton class="h-4 w-12" />
          <USkeleton class="h-4 w-24" />
          <USkeleton class="h-4 w-20" />
          <USkeleton class="h-4 w-20" />
          <USkeleton class="h-4 w-16" />
        </div>

        <!-- Table rows -->
        <div v-for="i in 3" :key="i" class="grid grid-cols-6 gap-4 py-3">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-5 w-16" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-20" />
          <USkeleton class="h-4 w-12" />
          <USkeleton class="h-8 w-16" />
        </div>
      </div>
    </UCard>
  </div>
</template>