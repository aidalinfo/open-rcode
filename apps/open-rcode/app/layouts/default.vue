<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'open-rcode'
const description = 'A development platform integrating AI to optimize your code projects.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://open-rcode.com/_og.png',
  twitterImage: 'https://open-rcode.com/_og.png',
  twitterCard: 'summary_large_image'
})

const open = ref(false)
const collapsed = ref(false)

const pageTitle = usePageTitle()
const navbarBadge = useNavbarBadge()

defineShortcuts({
  c: () => collapsed.value = !collapsed.value
})

watch(() => route.path, (newPath) => {
  // Reset badge on any navigation
  navbarBadge.value = null

  const pathSegments = newPath.split('/').filter(Boolean)
  const lastSegment = pathSegments.pop() || 'dashboard'
  
  // Capitalize first letter
  pageTitle.value = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
}, { immediate: true })

// Reactive data for recent tasks
const recentTasks = ref([])

// Fetch recent tasks
const fetchRecentTasks = async () => {
  try {
    const data = await $fetch('/api/tasks', {
      query: {
        page: 1,
        limit: 10
      }
    })
    recentTasks.value = data.tasks || []
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching recent tasks:', error)
  }
}

// Get task status icon
const getTaskStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return 'i-heroicons-check-circle'
    case 'running':
      return 'i-heroicons-arrow-path'
    case 'failed':
      return 'i-heroicons-x-circle'
    case 'pending':
    default:
      return 'i-heroicons-clock'
  }
}

const links = computed(() => [[
  {
  label: 'Dashboard',
  icon: 'i-heroicons-chart-bar',
  to: '/app/dashboard',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'New Prompt',
  icon: 'i-heroicons-plus-circle',
  to: '/app',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Recent Tasks',
  icon: 'i-heroicons-clock',
  type: 'trigger',
  defaultOpen: true,
  children: recentTasks.value.length > 0 ? recentTasks.value.map((task: any) => ({
    label: task.name || `Task ${task._id.substring(0, 8)}`,
    to: `/app/task/${task._id}`,
    description: `${task.environment?.name || 'N/A'} • ${new Date(task.createdAt).toLocaleDateString()}`,
    icon: getTaskStatusIcon(task.status),
    onSelect: () => {
      open.value = false
    }
  })) : [{
    label: 'No recent tasks',
    disabled: true
  }]
}, {
  label: 'Settings',
  icon: 'i-heroicons-cog-6-tooth',
  type: 'trigger',
  defaultOpen: true,
  children: [{
    label: 'General',
    to: '/app/settings',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Environments',
    to: '/app/settings/environnement',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Create Environment',
    to: '/app/settings/environnement/create',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'SubAgents',
    to: '/app/settings/subagent',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Create SubAgent',
    to: '/app/settings/subagent/create',
    onSelect: () => {
      open.value = false
    }
  }]
}], [{
  label: 'GitHub',
  icon: 'i-simple-icons-github',
  to: 'https://github.com/aidalinfo/open-rcode',
  target: '_blank'
}, {
  label: 'Documentation',
  icon: 'i-heroicons-document-text',
  to: 'https://doc.open-rcode.com',
  target: '_blank'
}]] satisfies NavigationMenuItem[][])

const groups = computed(() => [{
  id: 'navigation',
  label: 'Go to',
  items: links.value.flat()
}, {
  id: 'external',
  label: 'External',
  items: [{
    id: 'github',
    label: 'View on GitHub',
    icon: 'i-simple-icons-github',
    to: 'https://github.com/aidalinfo/open-rcode',
    target: '_blank'
  }]
}])

definePageMeta({
  middleware: 'auth'
})

// Load recent tasks on mount
onMounted(() => {
  fetchRecentTasks()
  
  // Refresh tasks every 30 seconds (only in browser)
  if (import.meta.client) {
    setInterval(() => {
      fetchRecentTasks()
    }, 30000)
  }
})
</script>

<template>
  <UDashboardGroup unit="rem" class="min-h-screen">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      v-model:collapsed="collapsed"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/app" >
          <LogoPro class="w-auto h-16 shrink-0" v-if="!collapsed"/>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel class="h-screen">
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
          {{ pageTitle }}
        </template>

        <template #trailing>
          <UBadge v-if="navbarBadge" :color="navbarBadge.color" :variant="navbarBadge.variant">{{ navbarBadge.label }}</UBadge>
        </template>
      </UDashboardNavbar>
      <UMain class="h-full overflow-y-auto">
        <slot />
      </UMain>
    </UDashboardPanel>

    <UDashboardSearch :groups="groups" />
  </UDashboardGroup>
</template>