<template>
  <div class="min-h-screen flex mt-12 justify-center">
    <div class="w-full max-w-4xl space-y-8">
      <!-- Recent Tasks skeleton -->
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" :class="{ 'hidden lg:block': i === 3 }" class="space-y-3">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <USkeleton class="h-6 w-20" />
                    <USkeleton class="h-4 w-16" />
                  </div>
                  <USkeleton class="h-4 w-12" />
                </div>
              </template>
              
              <div class="space-y-3">
                <!-- Nom de la tâche -->
                <USkeleton class="h-4 w-full" />
                <USkeleton class="h-4 w-2/3" />
                <!-- PR ou erreur -->
                <div class="flex items-center space-x-2">
                  <USkeleton class="h-4 w-4" />
                  <USkeleton class="h-4 w-24" />
                </div>
              </div>

              <template #footer>
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-1">
                    <USkeleton class="h-3 w-3" />
                    <USkeleton class="h-3 w-16" />
                  </div>
                  <div class="flex items-center space-x-1">
                    <USkeleton class="h-3 w-3" />
                    <USkeleton class="h-3 w-12" />
                  </div>
                </div>
              </template>
            </UCard>
          </div>
        </div>
      </div>

      <!-- Chat prompt skeleton -->
      <div class="space-y-4">
        <USkeleton class="h-32 w-full" />
        <div class="flex justify-between">
          <USkeleton class="h-10 w-32" />
          <USkeleton class="h-10 w-24" />
        </div>
      </div>
    </div>
  </div>
</template>