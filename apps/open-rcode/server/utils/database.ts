import mongoose from 'mongoose'
import { logger } from './logger'

let isConnected = false

export const connectToDatabase = async () => {
  if (isConnected) {
    return
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:password@localhost:27017/openrcode?authSource=admin'
    
    await mongoose.connect(mongoUri)
    isConnected = true
    logger.info({ mongoUri: mongoUri.replace(/:\/\/[^@]+@/, '://***@') }, 'Connected to MongoDB')
  } catch (error) {
    logger.error({ error }, 'Error connecting to MongoDB')
    throw error
  }
}

export const disconnectFromDatabase = async () => {
  if (!isConnected) {
    return
  }

  try {
    await mongoose.disconnect()
    isConnected = false
    logger.info('Disconnected from MongoDB')
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from MongoDB')
    throw error
  }
}