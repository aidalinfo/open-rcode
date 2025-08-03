export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate'
    }
  },
  uiPro: {
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },
  seo: {
    siteName: 'open-rcode Documentation'
  },
  header: {
    title: 'open-rcode',
    to: '/',
    logo: {
      alt: 'open-rcode',
      light: '',
      dark: ''
    },
    search: true,
    colorMode: true,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/aidalinfo/open-rcode',
      'target': '_blank',
      'aria-label': 'open-rcode on GitHub'
    }]
  },
  footer: {
    credits: `Copyright © ${new Date().getFullYear()} open-rcode`,
    colorMode: false,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/aidalinfo/open-rcode',
      'target': '_blank',
      'aria-label': 'open-rcode on GitHub'
    }, {
      'icon': 'i-lucide-rocket',
      'to': 'https://app.open-rcode.com',
      'target': '_blank',
      'aria-label': 'Try open-rcode Beta'
    }, {
      'icon': 'i-simple-icons-discord',
      'to': '',
      'target': '_blank',
      'aria-label': 'open-rcode Discord'
    }]
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Community',
      edit: 'https://github.com/aidalinfo/open-rcode/edit/main/docs/content',
      links: [{
        icon: 'i-lucide-star',
        label: 'Star on GitHub',
        to: 'https://github.com/aidalinfo/open-rcode',
        target: '_blank'
      }, {
        icon: 'i-lucide-rocket',
        label: 'Try Beta Platform',
        to: 'https://app.open-rcode.com',
        target: '_blank'
      }, {
        icon: 'i-lucide-book-open',
        label: 'Documentation',
        to: 'https://doc.open-rcode.com',
        target: '_blank'
      }]
    }
  }
})
