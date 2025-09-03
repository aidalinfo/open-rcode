// Middleware global pour intercepter les erreurs 401 et rediriger vers /login
import { defineNuxtRouteMiddleware, navigateTo } from '#app'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.client) {
    // Intercepte toutes les réponses fetch
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 401) {
        // Redirige vers /login si la session a expiré
        navigateTo('/login')
      }
      return response
    }
  }
})
