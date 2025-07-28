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

        <UFormGroup label="Environnement" name="environmentId" class="mt-4" required>
          <USelectMenu 
            v-model="state.environmentId" 
            :items="environments"
            option-attribute="label"
            value-attribute="value"
            placeholder="Sélectionner un environnement"
            :loading="loadingEnvironments"
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
  environmentId: z.string().min(1, 'L\'environnement est requis')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  name: '',
  environmentId: ''
})

const loading = ref(false)
const loadingEnvironments = ref(false)
const environments = ref<Array<{ label: string; value: string }>>([])

// Charger les environnements
const loadEnvironments = async () => {
  loadingEnvironments.value = true
  
  try {
    const response = await $fetch('/api/environments')
    environments.value = response.environments.map((env: any) => ({
      label: `${env.name} (${env.repositoryFullName})`,
      value: env.id
    }))
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger les environnements',
      color: 'red'
    })
  } finally {
    loadingEnvironments.value = false
  }
}

// Charger les environnements au montage
onMounted(() => {
  loadEnvironments()
})

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