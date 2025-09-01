<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const appConfig = useAppConfig()
const { data: user, pending } = await useFetch('/api/user/profile')
const router = useRouter()

const colors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const neutrals = ['slate', 'gray', 'zinc', 'neutral', 'stone']

const userDisplay = computed(() => ({
  name: user.value?.name || user.value?.username || 'User',
  avatar: user.value?.avatar
    ? {
        src: user.value.avatar,
        alt: user.value.name || user.value.username
      }
    : undefined
}))

const handleLogout = async () => {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

const items = computed<DropdownMenuItem[][]>(() => {
  if (!user.value) return []

  return [[{
    type: 'label',
    label: userDisplay.value.name,
    avatar: userDisplay.value.avatar
  }], [{
    label: 'Settings',
    icon: 'i-lucide-settings',
    to: '/app/settings'
  }], [{
    label: 'API Keys',
    icon: 'i-lucide-key',
    children: [{
      label: 'Anthropic API',
      icon: user.value.hasAnthropicKey ? 'i-lucide-check-circle' : 'i-lucide-circle',
      description: user.value.hasAnthropicKey ? 'Configured' : 'Not configured',
      to: '/app/settings'
    }, {
      label: 'Claude OAuth',
      icon: user.value.hasClaudeOAuthToken ? 'i-lucide-check-circle' : 'i-lucide-circle',
      description: user.value.hasClaudeOAuthToken ? 'Connected' : 'Not connected',
      to: '/app/settings'
    }, {
      label: 'Gemini API',
      icon: user.value.hasGeminiApiKey ? 'i-lucide-check-circle' : 'i-lucide-circle',
      description: user.value.hasGeminiApiKey ? 'Configured' : 'Not configured',
      to: '/app/settings'
    }]
  }, {
    label: 'GitHub App',
    icon: 'i-simple-icons-github',
    description: user.value.githubAppInstalled ? 'Installed' : 'Not installed',
    to: user.value.githubAppInstalled ? undefined : '/app/settings'
  }], [{
    label: 'Theme',
    icon: 'i-lucide-palette',
    children: [{
      label: 'Primary',
      slot: 'chip',
      chip: appConfig.ui.colors.primary,
      content: {
        align: 'center',
        collisionPadding: 16
      },
      children: colors.map(color => ({
        label: color,
        chip: color,
        slot: 'chip',
        checked: appConfig.ui.colors.primary === color,
        type: 'checkbox',
        onSelect: (e) => {
          e.preventDefault()
          appConfig.ui.colors.primary = color
        }
      }))
    }, {
      label: 'Neutral',
      slot: 'chip',
      chip: appConfig.ui.colors.neutral === 'neutral' ? 'old-neutral' : appConfig.ui.colors.neutral,
      content: {
        align: 'end',
        collisionPadding: 16
      },
      children: neutrals.map(color => ({
        label: color,
        chip: color === 'neutral' ? 'old-neutral' : color,
        slot: 'chip',
        type: 'checkbox',
        checked: appConfig.ui.colors.neutral === color,
        onSelect: (e) => {
          e.preventDefault()
          appConfig.ui.colors.neutral = color
        }
      }))
    }]
  }, {
    label: 'Appearance',
    icon: 'i-lucide-sun-moon',
    children: [{
      label: 'Light',
      icon: 'i-lucide-sun',
      type: 'checkbox',
      checked: colorMode.value === 'light',
      onSelect(e: Event) {
        e.preventDefault()
        colorMode.preference = 'light'
      }
    }, {
      label: 'Dark',
      icon: 'i-lucide-moon',
      type: 'checkbox',
      checked: colorMode.value === 'dark',
      onUpdateChecked(checked: boolean) {
        if (checked) {
          colorMode.preference = 'dark'
        }
      },
      onSelect(e: Event) {
        e.preventDefault()
        colorMode.preference = 'dark'
      }
    }]
  }], [{
    label: 'Documentation',
    icon: 'i-lucide-book-open',
    to: 'https://docs.open-rcode.com',
    target: '_blank'
  }, {
    label: 'GitHub Repository',
    icon: 'i-simple-icons-github',
    to: 'https://github.com/aidalinfo/open-rcode',
    target: '_blank'
  }], [{
    label: 'Log out',
    icon: 'i-lucide-log-out',
    onSelect: () => {
      handleLogout()
    }
  }]]
})
</script>

<template>
  <UDropdownMenu
    v-if="!pending && user"
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        ...userDisplay,
        label: collapsed ? undefined : userDisplay?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />

    <template #chip-leading="{ item }">
      <span
        :style="{
          '--chip-light': `var(--color-${(item as any).chip}-500)`,
          '--chip-dark': `var(--color-${(item as any).chip}-400)`
        }"
        class="ms-0.5 size-2 rounded-full bg-(--chip-light) dark:bg-(--chip-dark)"
      />
    </template>
  </UDropdownMenu>

  <USkeleton
    v-else
    class="h-10 w-full"
  />
</template>
