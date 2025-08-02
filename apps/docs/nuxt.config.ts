export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n','@nuxtjs/sitemap'],
  site: {
    url: 'https://doc.open-rcode.com',
  },
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
