<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Créer un kanban</h1>
    </div>

    <UCard class="max-w-2xl">
      <UForm :schema="schema" :state="state" @submit="onSubmit">
        <UFormGroup label="Nom" name="name" required>
          <UInput v-model="state.name" placeholder="Nom du kanban" />
        </UFormGroup>

        <UFormGroup label="Description" name="description" class="mt-4">
          <UTextarea v-model="state.description" placeholder="Description du kanban" rows="4" />
        </UFormGroup>

        <UFormGroup label="Colonnes" name="columns" class="mt-4" required>
          <div class="space-y-2">
            <div v-for="(column, index) in state.columns" :key="index" class="flex gap-2">
              <UInput 
                v-model="column.name" 
                placeholder="Nom de la colonne"
                class="flex-1"
              />
              <UInput 
                v-model="column.order" 
                type="number"
                placeholder="Ordre"
                class="w-24"
              />
              <UButton 
                icon="i-heroicons-trash" 
                color="red" 
                variant="soft"
                @click="removeColumn(index)"
                :disabled="state.columns.length <= 1"
              />
            </div>
            <UButton 
              icon="i-heroicons-plus" 
              color="gray" 
              variant="soft"
              @click="addColumn"
              block
            >
              Ajouter une colonne
            </UButton>
          </div>
        </UFormGroup>

        <UFormGroup label="Couleur" name="color" class="mt-4">
          <UInput 
            v-model="state.color" 
            type="color"
            class="w-24"
          />
        </UFormGroup>

        <UFormGroup label="Statut" name="status" class="mt-4">
          <USelect 
            v-model="state.status" 
            :options="statusOptions"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormGroup>

        <div class="mt-6 flex gap-3">
          <UButton type="submit" :loading="loading">
            Créer
          </UButton>
          <UButton color="gray" variant="soft" to="/app/kanban">
            Annuler
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import type { FormError, FormSubmitEvent } from '#ui/types'

const router = useRouter()
const toast = useToast()

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  columns: z.array(z.object({
    name: z.string().min(1, 'Le nom de la colonne est requis'),
    order: z.number().int().min(0)
  })).min(1, 'Au moins une colonne est requise'),
  color: z.string().optional(),
  status: z.enum(['active', 'archived']).default('active')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  name: '',
  description: '',
  columns: [
    { name: 'À faire', order: 0 },
    { name: 'En cours', order: 1 },
    { name: 'Terminé', order: 2 }
  ],
  color: '#3b82f6',
  status: 'active'
})

const statusOptions = [
  { label: 'Actif', value: 'active' },
  { label: 'Archivé', value: 'archived' }
]

const loading = ref(false)

const addColumn = () => {
  const maxOrder = Math.max(...state.columns.map(c => c.order), -1)
  state.columns.push({ name: '', order: maxOrder + 1 })
}

const removeColumn = (index: number) => {
  state.columns.splice(index, 1)
}

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  
  try {
    const response = await $fetch('/api/kanban-projects', {
      method: 'POST',
      body: event.data
    })
    
    toast.add({
      title: 'Kanban créé',
      description: 'Le kanban a été créé avec succès',
      color: 'green'
    })
    
    await router.push('/app/kanban')
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Une erreur est survenue lors de la création du kanban',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}
</script>