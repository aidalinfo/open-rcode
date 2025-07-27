import mongoose, { Schema, Document } from 'mongoose'

export interface UserCost {
  environmentId: string;
  costUsd: number;
  model: 'opus' | 'sonnet';
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCostDocument extends UserCost, Document {}

const userCostSchema = new Schema<UserCostDocument>({
  environmentId: { type: String, required: true },
  costUsd: { type: Number, required: true },
  model: {
    type: String,
    enum: ['opus', 'sonnet'],
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
userCostSchema.index({ createdAt: -1 })

export const UserCostModel = mongoose.models.UserCost || mongoose.model<UserCostDocument>('UserCost', userCostSchema)