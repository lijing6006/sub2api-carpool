import { apiClient } from '../client'
import type { AdminUser, PaginatedResponse } from '@/types'

export interface TemporaryMember extends AdminUser {
  temporary_expires_at: string
  temporary_budget_usd: number
  temporary_spent_usd: number
}

export interface TemporaryMemberInput {
  email: string
  username: string
  password: string
  balance: number
  temporary_expires_at: string
  temporary_budget_usd: number
}

export async function listTemporaryMembers(page = 1, search = '', signal?: AbortSignal) {
  const { data } = await apiClient.get<PaginatedResponse<TemporaryMember>>('/admin/users', {
    params: { page, page_size: 20, temporary_only: true, include_subscriptions: false, search, sort_by: 'created_at', sort_order: 'desc' },
    signal
  })
  return data
}

export async function createTemporaryMember(input: TemporaryMemberInput) {
  const { data } = await apiClient.post<TemporaryMember>('/admin/users', {
    ...input, role: 'user', concurrency: 1, rpm_limit: 30
  })
  return data
}

export async function updateTemporaryMember(id: number, input: {
  temporary_expires_at?: string
  temporary_budget_usd?: number
  status?: 'active' | 'disabled'
}) {
  const { data } = await apiClient.put<TemporaryMember>(`/admin/users/${id}`, input)
  return data
}
