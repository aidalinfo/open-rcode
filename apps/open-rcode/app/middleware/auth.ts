// Middleware global pour intercepter les erreurs 401 et rediriger vers /login
import { defineNuxtRouteMiddleware, navigateTo } from '#app'

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Interception globale des 401 côté client (wrap une seule fois)
  if (import.meta.client && !(window as any).__authFetchWrapped) {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 401) {
        // Redirige vers la page d'accueil si la session est invalide
        navigateTo('/')
      }
      return response
    }
    ;(window as any).__authFetchWrapped = true
  }

  // Ne pas vérifier pour les routes publiques
  const publicPaths = ['/', '/login']
  if (publicPaths.includes(to.path)) {
    return
  }

  // Vérifie la session via l'endpoint dédié
  try {
    const { valid } = await $fetch<{ valid: boolean }>('/api/user/session')
    if (!valid) {
      return navigateTo('/')
    }
  } catch (e) {
    // En cas d'erreur (réseau/serveur), considérer invalide
    return navigateTo('/')
  }
})
