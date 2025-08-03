import consola from 'consola'
import type { NitroApp } from 'nitropack'

// Define all environment variables used in the application
const ENV_VARIABLES = {
  // Database
  DATABASE_URL: { required: true, sensitive: false, description: 'MongoDB connection URL' },
  MONGODB_URI: { required: false, sensitive: false, description: 'MongoDB URI (alternative)' },
  
  // Container Mode
  CONTAINER_MODE: { required: true, sensitive: false, description: 'Container mode (docker/kubernetes)' },
  DOCKER_HOST: { required: false, sensitive: false, description: 'Docker daemon host' },
  DOCKER_PORT: { required: false, sensitive: false, description: 'Docker daemon port' },
  
  // Kubernetes
  KUBERNETES_NAMESPACE: { required: false, sensitive: false, description: 'K8s namespace' },
  KUBECONFIG: { required: false, sensitive: false, description: 'K8s config path' },
  KUBERNETES_CONTEXT: { required: false, sensitive: false, description: 'K8s context' },
  
  // GitHub
  GITHUB_APP_ID: { required: true, sensitive: false, description: 'GitHub App ID' },
  GITHUB_APP_PRIVATE_KEY: { required: true, sensitive: true, description: 'GitHub App private key' },
  GITHUB_APP_PRIVATE_KEY_PATH: { required: false, sensitive: false, description: 'GitHub App private key path' },
  GITHUB_CLIENT_ID: { required: true, sensitive: false, description: 'GitHub OAuth client ID' },
  GITHUB_CLIENT_SECRET: { required: true, sensitive: true, description: 'GitHub OAuth client secret' },
  GITHUB_REDIRECT_URI: { required: false, sensitive: false, description: 'GitHub OAuth redirect URI' },
  
  // Security
  ENCRYPTION_KEY: { required: true, sensitive: true, description: 'Encryption key (32 chars)' },
  
  // Admin
  ADMIN_GOOGLE_API_KEY: { required: false, sensitive: true, description: 'Admin Gemini API key' },
  BASE_ROLE: { required: false, sensitive: false, description: 'Default user role' },
  
  // Nuxt
  NUXT_UI_PRO_LICENSE: { required: true, sensitive: true, description: 'Nuxt UI Pro license' },
  
  // Port
  PORT: { required: false, sensitive: false, description: 'Server port' },
  NITRO_PORT: { required: false, sensitive: false, description: 'Nitro server port' }
}

function maskSensitiveValue(value: string, sensitive: boolean): string {
  if (!sensitive) return value
  
  // Show first 4 and last 4 characters for longer values
  if (value.length > 12) {
    return `${value.substring(0, 4)}${'*'.repeat(8)}${value.substring(value.length - 4)}`
  }
  
  // For shorter values, just show asterisks
  return '*'.repeat(value.length)
}

function getStatusIcon(configured: boolean, required: boolean): string {
  if (configured) return '✅'
  if (required) return '❌'
  return '⚪'
}

export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('render:html', () => {
    // Only log once on startup
    if (process.env._ENV_LOGGED) return
    process.env._ENV_LOGGED = 'true'
    
    consola.box('🚀 Open RCode - Environment Variables Status')
    
    const tableData: any[] = []
    let totalRequired = 0
    let totalConfigured = 0
    let missingRequired: string[] = []
    
    for (const [key, config] of Object.entries(ENV_VARIABLES)) {
      const value = process.env[key]
      const configured = !!value
      
      if (config.required) totalRequired++
      if (configured) totalConfigured++
      if (config.required && !configured) missingRequired.push(key)
      
      tableData.push({
        'Variable': key,
        'Status': getStatusIcon(configured, config.required),
        'Required': config.required ? 'Yes' : 'No',
        'Configured': configured ? 'Yes' : 'No',
        'Value': configured ? maskSensitiveValue(value!, config.sensitive) : '-',
        'Description': config.description
      })
    }
    
    // Log the table
    console.table(tableData)
    
    // Summary
    consola.info('')
    consola.info('📊 Configuration Summary:')
    consola.info(`   Total variables: ${Object.keys(ENV_VARIABLES).length}`)
    consola.info(`   Required: ${totalRequired}`)
    consola.info(`   Configured: ${totalConfigured}`)
    
    // Container mode specific info
    const containerMode = process.env.CONTAINER_MODE
    if (containerMode) {
      consola.info(`   Container Mode: ${containerMode}`)
    }
    
    // Warnings for missing required variables
    if (missingRequired.length > 0) {
      consola.warn('')
      consola.warn('⚠️  Missing required environment variables:')
      missingRequired.forEach(v => {
        consola.warn(`   - ${v}: ${ENV_VARIABLES[v as keyof typeof ENV_VARIABLES].description}`)
      })
    } else {
      consola.success('')
      consola.success('✅ All required environment variables are configured!')
    }
    
    consola.info('')
    consola.info('💡 Legend: ✅ Configured | ❌ Required but missing | ⚪ Optional')
    consola.info('')
  })
})