<script setup lang="ts">
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
const description = 'A collaborative development platform integrating AI to optimize your code projects.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://assets.hub.nuxt.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL3VpLXByby1zdGFydGVyLm51eHQuZGV2IiwiaWF0IjoxNzM5NDYzMzk4fQ.XLzPkSW6nRbPW07QO1RkMwz_RAPA4KfeyrWrK3li9YI.jpg?theme=light',
  twitterImage: 'https://assets.hub.nuxt.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL3VpLXByby1zdGFydGVyLm51eHQuZGV2IiwiaWF0IjoxNzM5NDYzMzk4fQ.XLzPkSW6nRbPW07QO1RkMwz_RAPA4KfeyrWrK3li9YI.jpg?theme=light',
  twitterCard: 'summary_large_image'
})

const items = computed(() => [{
  label: 'Dashboard',
  to: '/app/dashboard',
  icon: 'i-heroicons-chart-bar',
  active: route.path.startsWith('/app/dashboard')
}, {
  label: 'Kanban',
  to: '/app/kanban',
  icon: 'i-heroicons-view-columns',
  active: route.path.startsWith('/app/kanban'),
  disabled: true
}, {
  label: 'Settings',
  to: '/app/settings',
  icon: 'i-heroicons-cog-6-tooth',
  active: route.path.startsWith('/app/settings')
}])
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/app">
          <LogoPro class="w-auto h-24 shrink-0" />
        </NuxtLink>
      </template>

      <UNavigationMenu
        :items="items"
        variant="link"
      />

      <template #right>
        <UColorModeButton />

        <UButton
          to="https://github.com/aidalinfo/open-rcode"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>

      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <USeparator />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Copyright © {{ new Date().getFullYear() }}
        </p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/aidalinfo/open-rcode"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </UApp>
</template>
