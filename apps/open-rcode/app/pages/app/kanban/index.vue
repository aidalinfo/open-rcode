<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Kanbans
      </h1>
      <NuxtLink to="/app/kanban/create">
        <UButton
          icon="i-heroicons-plus"
          size="sm"
        >
          Créer un kanban
        </UButton>
      </NuxtLink>
    </div>

    <UCard>
      <UTable
        :columns="columns"
        :rows="kanbanProjects"
        :loading="pending"
        :empty-state="{ icon: 'i-heroicons-circle-stack-20-solid', label: 'Aucun kanban trouvé' }"
      >
        <template #actions-data="{ row }">
          <UDropdown :items="getActions(row)">
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-ellipsis-horizontal-20-solid"
            />
          </UDropdown>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const columns = [
  {
    key: 'name',
    label: 'Nom'
  },
  {
    key: 'description',
    label: 'Description'
  },
  {
    key: 'createdAt',
    label: 'Créé le'
  },
  {
    key: 'actions',
    label: 'Actions'
  }
]

const { data: kanbanProjects, pending, refresh } = await useFetch('/api/kanban-projects')

const getActions = (row: any) => {
  return [
    [{
      label: 'Modifier',
      icon: 'i-heroicons-pencil-square-20-solid',
      click: () => navigateTo(`/app/kanban/${row.id}/edit`)
    }],
    [{
      label: 'Supprimer',
      icon: 'i-heroicons-trash-20-solid',
      click: async () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce kanban ?')) {
          await $fetch(`/api/kanban-projects/${row.id}`, { method: 'DELETE' })
          await refresh()
        }
      }
    }]
  ]
}
</script>
