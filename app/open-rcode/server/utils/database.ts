import mongoose from 'mongoose'

let isConnected = false

export const connectToDatabase = async () => {
  if (isConnected) {
    return
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:password@localhost:27017/ccweb?authSource=admin'
    
    await mongoose.connect(mongoUri)
    isConnected = true
    if (process.dev) console.log('Connected to MongoDB')
  } catch (error) {
    if (process.dev) console.error('Error connecting to MongoDB:', error)
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
    if (process.dev) console.log('Disconnected from MongoDB')
  } catch (error) {
    if (process.dev) console.error('Error disconnecting from MongoDB:', error)
    throw error
  }
}