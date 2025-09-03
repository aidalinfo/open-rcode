<template>
  <UCard :ui="{ body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          Total Spending
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          ---
        </p>
        <p class="text-xs text-muted mt-1">
          Last 30 days
        </p>
      </div>
    </template>

    <div class="h-96 flex items-center justify-center">
      <div class="text-muted">
        Loading chart...
      </div>
    </div>
  </UCard>
</template>
