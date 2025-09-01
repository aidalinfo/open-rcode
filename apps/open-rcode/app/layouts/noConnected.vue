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
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/app">
        <LogoPro class="w-auto h-24 shrink-0" />
      </NuxtLink>
    </template>

    <UNavigationMenu
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
        orientation="vertical"
        class="-mx-2.5"
      />
    </template>
  </UHeader>

  <UMain>
    <slot />
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
</template>
