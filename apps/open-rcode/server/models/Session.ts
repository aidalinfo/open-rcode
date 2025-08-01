import mongoose, { Schema, Document } from 'mongoose'

export interface Session {
  userId: string;
  sessionToken: string;
  expires: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument extends Session, Document {}

const sessionSchema = new Schema<SessionDocument>({
  userId: { type: String, required: true },
  sessionToken: { type: String, required: true, unique: true },
  expires: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

sessionSchema.pre('save', function() {
  this.updatedAt = new Date()
})

export const SessionModel = mongoose.models.Session || mongoose.model<SessionDocument>('Session', sessionSchema)