<script setup lang="ts">
import { format } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
  period?: 'daily' | 'weekly' | 'monthly'
  days?: number
}>()

const currentPeriod = computed(() => props.period || 'daily')
const currentDays = computed(() => props.days || 30)

type DataRecord = {
  date: Date
  amount: number
}

const { width } = useElementSize(cardRef)

const { data: costsData, pending } = await useFetch('/api/dashboard/costs-history', {
  query: {
    period: currentPeriod,
    days: currentDays
  }
})

const data = computed<DataRecord[]>(() => {
  if (!costsData.value?.costs) return []
  
  return costsData.value.costs.map(c => ({
    date: new Date(c.date),
    amount: c.amount
  }))
})

const x = (_: DataRecord, i: number) => i
const y = (d: DataRecord) => d.amount

const total = computed(() => data.value.reduce((acc: number, { amount }) => acc + amount, 0))

const formatNumber = (value: number) => {
  return value.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 2 
  })
}

const formatDate = (date: Date): string => {
  const formats = {
    daily: 'd MMM',
    weekly: 'd MMM',
    monthly: 'MMM yyyy'
  }
  return format(date, formats[currentPeriod.value])
}

const xTicks = (i: number) => {
  if (!data.value[i]) return ''
  
  const totalTicks = data.value.length
  const maxTicks = 6
  
  if (totalTicks <= maxTicks) {
    return formatDate(data.value[i].date)
  }
  
  const interval = Math.floor(totalTicks / maxTicks)
  if (i % interval === 0 || i === totalTicks - 1) {
    return formatDate(data.value[i].date)
  }
  
  return ''
}

const template = (d: DataRecord) => `${formatDate(d.date)}: ${formatNumber(d.amount)}`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          Total Spending
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          {{ formatNumber(total) }}
        </p>
        <p class="text-xs text-muted mt-1">
          Last {{ currentDays }} days
        </p>
      </div>
    </template>

    <div v-if="pending" class="h-96 flex items-center justify-center text-muted">
      Loading...
    </div>
    
    <VisXYContainer
      v-else-if="data.length > 0"
      :data="data"
      :padding="{ top: 40, bottom: 40 }"
      class="h-96"
      :width="width"
    >
      <VisLine
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :curve-type="'monotone-x'"
      />
      <VisArea
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :opacity="0.1"
        :curve-type="'monotone-x'"
      />

      <VisAxis
        type="x"
        :x="x"
        :tick-format="xTicks"
        :tick-text-angle="0"
        :tick-text-anchor="'middle'"
      />
      
      <VisAxis
        type="y"
        :y="y"
        :tick-format="(v: number) => `$${v.toFixed(0)}`"
      />

      <VisCrosshair
        color="var(--ui-primary)"
        :template="template"
      />

      <VisTooltip />
    </VisXYContainer>
    
    <div v-else class="h-96 flex items-center justify-center text-muted">
      No cost data available
    </div>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>