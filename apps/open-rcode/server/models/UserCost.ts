import mongoose, { Schema, Document } from 'mongoose'

export interface UserCost {
  environmentId: string;
  userId: string;
  taskId: string;
  costUsd: number;
  model: 'opus' | 'sonnet' | 'opus-4-1';
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCostDocument extends UserCost, Document {}

const userCostSchema = new Schema<UserCostDocument>({
  environmentId: { type: String, required: true },
  userId: { type: String, required: true },
  taskId: { type: String, required: true },
  costUsd: { type: Number, required: true },
  model: {
    type: String,
    enum: ['opus', 'sonnet', 'opus-4-1'],
    required: true
  },
  aiProvider: {
    type: String,
    enum: ['anthropic-api', 'claude-oauth', 'gemini-cli'],
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

userCostSchema.pre('save', function() {
  this.updatedAt = new Date()
})

userCostSchema.index({ environmentId: 1 })
userCostSchema.index({ userId: 1 })
userCostSchema.index({ taskId: 1 })
userCostSchema.index({ createdAt: -1 })

export const UserCostModel = mongoose.models.UserCost || mongoose.model<UserCostDocument>('UserCost', userCostSchema)