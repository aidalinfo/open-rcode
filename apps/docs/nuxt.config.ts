export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n','@nuxtjs/sitemap'],
  i18n: {
    lazy: false,
    defaultLocale: 'en',
    locales: [{
      code: 'en',
      name: 'English',
    }, {
      code: 'fr',
      name: 'Français',
    }],
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
})
