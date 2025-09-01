import pino from 'pino'

// Déterminer le niveau de log basé sur l'environnement
const isDevelopment = process.env.NODE_ENV === 'development'
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')

// Configuration pour le développement avec pretty-print
const developmentTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    ignore: 'pid,hostname',
    translateTime: 'HH:MM:ss',
    messageFormat: '{msg}'
  }
}

// Créer le logger avec configuration conditionnelle
export const logger = pino({
  level: logLevel,
  // Pretty-print en développement, JSON en production
  ...(isDevelopment && {
    transport: developmentTransport
  }),
  // Ajouter des champs par défaut
  base: {
    env: process.env.NODE_ENV
  },
  // Formater les erreurs pour une meilleure lisibilité
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
})

// Créer des loggers enfants pour différents modules
export const createLogger = (module: string) => {
  return logger.child({ module })
}

// Helpers pour ajouter du contexte
export const logWithContext = (context: Record<string, any>) => {
  return logger.child(context)
}

// Export des niveaux pour référence
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
} as const
