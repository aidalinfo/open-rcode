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
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
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
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error)
    throw error
  }
}