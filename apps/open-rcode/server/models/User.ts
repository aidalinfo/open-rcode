import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export enum UserRole {
  BASIC = 'basic',
  PREMIUM = 'premium',
  ADMIN = 'admin'
}

export interface User {
  githubId: string
  username: string
  email?: string
  name?: string
  avatar?: string
  bio?: string
  location?: string
  githubAppInstallationIds?: string[]
  githubAppInstalledAt?: Date
  anthropicKey?: string
  claudeOAuthToken?: string
  geminiApiKey?: string
  // Codex / OpenAI credentials
  openaiApiKey?: string
  codexOAuthJson?: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface UserDocument extends User, Document {}

const userSchema = new Schema<UserDocument>({
  githubId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: { type: String },
  name: { type: String },
  avatar: { type: String },
  bio: { type: String },
  location: { type: String },
  githubAppInstallationIds: { type: [String], default: [] },
  githubAppInstalledAt: { type: Date },
  anthropicKey: { type: String },
  claudeOAuthToken: { type: String },
  geminiApiKey: { type: String },
  // Encrypted values, same scheme as others
  openaiApiKey: { type: String },
  codexOAuthJson: { type: String },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: process.env.BASE_ROLE || UserRole.BASIC
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

userSchema.pre('save', function () {
  this.updatedAt = new Date()
})

export const UserModel = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema)
