//Pagination type for frontend and backend

export interface Pagination<T = Record<string, any>> {
  pages: number;
  limit: number;
  total?: number;
  currentPage?: number;
  filters: T;
}