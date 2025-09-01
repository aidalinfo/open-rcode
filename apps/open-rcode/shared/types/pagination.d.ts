// Pagination type for frontend and backend

export interface Pagination<T = Record<string, any>> {
  page: number
  limit: number
  total?: number
  totalPages?: number
  filters: T
}
