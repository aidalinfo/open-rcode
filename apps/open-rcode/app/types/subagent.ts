export interface SubAgent {
  _id: string
  name: string
  description?: string
  prompt: string
  isPublic: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

export interface SubAgentsResponse {
  subAgents: SubAgent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
