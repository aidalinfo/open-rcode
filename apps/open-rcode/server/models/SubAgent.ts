import { Schema, model, type Document } from 'mongoose'

export interface SubAgent extends Document {
  name: string
  description?: string
  prompt: string
  isPublic: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

const SubAgentSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  prompt: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  userId: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
})

// Create compound index for efficient queries
SubAgentSchema.index({ userId: 1, isPublic: 1 })
SubAgentSchema.index({ isPublic: 1, createdAt: -1 })

// Pre-save hook to update the updatedAt field
SubAgentSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

export const SubAgentModel = model<SubAgent>('SubAgent', SubAgentSchema)