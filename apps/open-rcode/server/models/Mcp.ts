import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export type McpType = 'sse' | 'stdio'

export interface Mcp {
  userId: string
  name: string
  type: McpType
  url?: string
  command?: string
  args?: string[]
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface McpDocument extends Mcp, Document {}

const mcpSchema = new Schema<McpDocument>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['sse', 'stdio'], required: true },
  url: { type: String },
  command: { type: String },
  args: { type: [String], default: [] },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

mcpSchema.pre('save', function () {
  this.updatedAt = new Date()
})

// Helpful indexes
mcpSchema.index({ userId: 1, name: 1 })
mcpSchema.index({ createdAt: -1 })

export const McpModel = mongoose.models.Mcp || mongoose.model<McpDocument>('Mcp', mcpSchema)

