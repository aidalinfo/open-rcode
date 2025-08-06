export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface TaskCard {
  _id: string
  name: string
  status: TaskStatus
  executed: boolean
  merged: boolean
  createdAt: string | Date
  updatedAt: string | Date
  environment: {
    name: string
  } | null
  pr: {
    url: string
    number: number
  } | null
  dockerId?: string
  error?: string
  planMode?: boolean
}

export interface TasksResponse {
  tasks: TaskCard[]
  total: number
  page: number
  limit: number
  totalPages: number
}