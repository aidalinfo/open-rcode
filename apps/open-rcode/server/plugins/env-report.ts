import { logger } from '../utils/logger'

function collectEnv() {
  const keys = [
    'MONGODB_URI',
    'ADMIN_GOOGLE_API_KEY',
    'CONTAINER_MODE',
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY_PATH',
    'GITHUB_APP_PRIVATE_KEY',
    'NODE_ENV',
    'LOG_LEVEL',
    'GITHUB_CLIENT_ID',
    'GITHUB_REDIRECT_URI',
    'GITHUB_CLIENT_SECRET',
    'BASE_ROLE',
    'KUBERNETES_NAMESPACE',
    'KUBECONFIG',
    'KUBERNETES_CONTEXT',
    'DOCKER_HOST',
    'DOCKER_PORT',
    'ENCRYPTION_KEY',
    'GITHUB_APP_NAME',
    'NUXT_UI_PRO_LICENSE'
  ]

  const values = keys.map(k => ({ key: k, configured: !!process.env[k], valuePreview: preview(process.env[k]) }))
  const extra = Object.keys(process.env)
    .filter(k => k.startsWith('OPENRCODE_') || k.startsWith('NUXT_'))
    .filter(k => !keys.includes(k))
    .sort()
    .map(k => ({ key: k, configured: !!process.env[k], valuePreview: preview(process.env[k]) }))
  return { known: values, extra }
}

function preview(v?: string) {
  if (!v) return ''
  if (v.length <= 6) return '*'.repeat(v.length)
  return `${v.slice(0, 2)}***${v.slice(-2)}`
}

export default async () => {
  const { known, extra } = collectEnv()
  logger.info({ known, extra }, 'Environment variables report')
}
