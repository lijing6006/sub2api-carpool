import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateBalance } from '../admin/users'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../client', () => ({ apiClient: { post } }))

describe('admin balance adjustment API', () => {
  beforeEach(() => { vi.clearAllMocks(); post.mockResolvedValue({ data: { id: 8, balance: 30 } }) })

  it('passes the same caller-owned operation key through to the server', async () => {
    expect(await updateBalance(8, 10, 'add', 'Confirmed offline credit', 'operation-42')).toEqual({ id: 8, balance: 30 })
    expect(post).toHaveBeenCalledWith('/admin/users/8/balance', {
      balance: 10, operation: 'add', notes: 'Confirmed offline credit'
    }, { headers: { 'Idempotency-Key': 'operation-42' } })
  })

  it('preserves compatibility for existing callers that do not provide an operation key', async () => {
    await updateBalance(8, 10, 'add')
    expect(post).toHaveBeenCalledWith('/admin/users/8/balance', {
      balance: 10, operation: 'add', notes: ''
    }, undefined)
  })
})
