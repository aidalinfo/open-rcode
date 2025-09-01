<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          File Indexation
        </h3>
        <p class="text-sm text-gray-500 mt-1">
          Index all files in the repository for faster access
        </p>
      </div>
      <div class="flex items-center gap-4">
        <div
          v-if="indexInfo"
          class="text-sm text-gray-500"
        >
          <span v-if="indexInfo.indexed">
            {{ (indexInfo.totalFiles ?? indexInfo.paths?.length) || 0 }} files indexed
            <time
              :datetime="indexInfo.indexedAt || undefined"
              class="ml-2"
            >
              ({{ formatDate(indexInfo.indexedAt || '') }})
            </time>
          </span>
          <span v-else>
            Not indexed
          </span>
        </div>

        <UButton
          variant="outline"
          size="sm"
          :loading="isIndexing"
          :disabled="!environmentId"
          @click="indexFiles"
        >
          <template #leading>
            <UIcon name="i-heroicons-magnifying-glass" />
          </template>
          {{ indexInfo?.indexed ? 'Re-index' : 'Index' }} Files
        </UButton>
      </div>
    </div>

    <!-- Indexed Files Tree -->
    <div
      v-if="indexInfo?.indexed"
      class="mt-6"
    >
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">
        Indexed Files ({{ indexedFiles.length }})
      </h4>
      <div class="rounded-lg p-4 max-h-80 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
        <UTree
          v-if="indexTree.length"
          :items="indexTree"
        />
        <div
          v-else
          class="text-center py-8 text-gray-500"
        >
          No files indexed yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface IndexInfo {
  indexed: boolean
  paths: string[]
  indexedAt: string | null
  totalFiles?: number
}

interface Props {
  environmentId: string | null
}

const props = defineProps<Props>()

const toast = useToast()

// State
const isIndexing = ref(false)
const indexInfo = ref<IndexInfo | null>(null)
const indexedFiles = ref<string[]>([])

// Tree structure for file index
const indexTree = computed(() => {
  if (!indexedFiles.value.length) return []
  return buildFileTree(indexedFiles.value)
})

// Methods
const fetchIndexInfo = async () => {
  if (!props.environmentId) return

  try {
    const data = await $fetch(`/api/environments/${props.environmentId}/file-index`)
    indexInfo.value = {
      indexed: data.indexed,
      paths: data.paths || [],
      indexedAt: data.indexedAt,
      totalFiles: (data as any).totalFiles ?? data.paths?.length ?? 0
    }
    indexedFiles.value = data.paths || []
  } catch (error) {
    if (import.meta.dev) console.error('Error fetching index info:', error)
  }
}

const indexFiles = async () => {
  if (!props.environmentId) return

  isIndexing.value = true
  try {
    await $fetch(`/api/environments/${props.environmentId}/file-index`, {
      method: 'POST'
    })

    toast.add({
      title: 'Indexing started',
      description: 'File indexing has been started in the background',
      color: 'success'
    })

    // Poll for completion
    let attempts = 0
    const maxAttempts = 30 // 30 seconds
    const pollInterval = setInterval(async () => {
      attempts++
      await fetchIndexInfo()

      if (indexInfo.value?.indexed || attempts >= maxAttempts) {
        clearInterval(pollInterval)
        isIndexing.value = false

        if (indexInfo.value?.indexed) {
          toast.add({
            title: 'Indexing completed',
            description: `Successfully indexed ${indexInfo.value?.totalFiles ?? indexInfo.value?.paths.length ?? 0} files`,
            color: 'success'
          })
        }
      }
    }, 1000)
  } catch (error) {
    if (import.meta.dev) console.error('Error starting indexation:', error)
    toast.add({
      title: 'Error',
      description: 'Unable to start file indexation',
      color: 'error'
    })
    isIndexing.value = false
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Build tree structure from file paths
const buildFileTree = (paths: string[]) => {
  const tree: any[] = []

  paths.forEach((path) => {
    const parts = path.split('/')
    let current = tree
    let currentPath = ''

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = index === parts.length - 1

      let existing = current.find(item => item.label === part)

      if (!existing) {
        existing = {
          label: part,
          ...(isFile ? { icon: getFileIcon(part) } : { children: [], defaultExpanded: index < 2 })
        }
        current.push(existing)
      }

      if (!isFile) {
        current = existing.children
      }
    })
  })

  return tree
}

// Get icon based on file extension
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()

  const iconMap: Record<string, string> = {
    // Web files
    vue: 'i-vscode-icons-file-type-vue',
    js: 'i-vscode-icons-file-type-js',
    ts: 'i-vscode-icons-file-type-typescript',
    jsx: 'i-vscode-icons-file-type-reactjs',
    tsx: 'i-vscode-icons-file-type-reactts',
    html: 'i-vscode-icons-file-type-html',
    css: 'i-vscode-icons-file-type-css',
    scss: 'i-vscode-icons-file-type-scss',
    sass: 'i-vscode-icons-file-type-sass',
    less: 'i-vscode-icons-file-type-less',

    // Config files
    json: 'i-vscode-icons-file-type-json',
    yaml: 'i-vscode-icons-file-type-yaml',
    yml: 'i-vscode-icons-file-type-yaml',
    toml: 'i-vscode-icons-file-type-toml',
    env: 'i-vscode-icons-file-type-dotenv',

    // Build/Package
    dockerfile: 'i-vscode-icons-file-type-docker',
    lock: 'i-vscode-icons-file-type-npm',

    // Documentation
    md: 'i-vscode-icons-file-type-markdown',
    mdx: 'i-vscode-icons-file-type-mdx',
    txt: 'i-vscode-icons-file-type-text',
    pdf: 'i-vscode-icons-file-type-pdf',

    // Programming languages
    py: 'i-vscode-icons-file-type-python',
    rb: 'i-vscode-icons-file-type-ruby',
    php: 'i-vscode-icons-file-type-php',
    go: 'i-vscode-icons-file-type-go',
    rs: 'i-vscode-icons-file-type-rust',
    java: 'i-vscode-icons-file-type-java',
    kt: 'i-vscode-icons-file-type-kotlin',
    swift: 'i-vscode-icons-file-type-swift',
    c: 'i-vscode-icons-file-type-c',
    cpp: 'i-vscode-icons-file-type-cpp',
    cs: 'i-vscode-icons-file-type-csharp',

    // Images
    png: 'i-vscode-icons-file-type-image',
    jpg: 'i-vscode-icons-file-type-image',
    jpeg: 'i-vscode-icons-file-type-image',
    gif: 'i-vscode-icons-file-type-image',
    svg: 'i-vscode-icons-file-type-svg',
    webp: 'i-vscode-icons-file-type-image',

    // Archives
    zip: 'i-vscode-icons-file-type-zip',
    tar: 'i-vscode-icons-file-type-zip',
    gz: 'i-vscode-icons-file-type-zip'
  }

  // Special file names
  if (filename.toLowerCase() === 'package.json') return 'i-vscode-icons-file-type-node'
  if (filename.toLowerCase() === 'dockerfile') return 'i-vscode-icons-file-type-docker'
  if (filename.toLowerCase().startsWith('readme')) return 'i-vscode-icons-file-type-markdown'
  if (filename.toLowerCase().includes('license')) return 'i-vscode-icons-file-type-license'

  return iconMap[ext || ''] || 'i-heroicons-document'
}

// Watch for environmentId changes
watch(() => props.environmentId, (newId) => {
  if (newId) {
    fetchIndexInfo()
  }
})

// Initial load
onMounted(() => {
  if (props.environmentId) {
    fetchIndexInfo()
  }
})

// Expose methods for parent
defineExpose({
  fetchIndexInfo,
  indexFiles
})
</script>
