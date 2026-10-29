import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeMemberBalanceOperation, prepareMemberBalanceOperation } from '../memberBalanceOperation'

let adminIdentity = 5000
beforeEach(() => {
  sessionStorage.clear()
  localStorage.setItem('auth_user', JSON.stringify({ id: ++adminIdentity }))
})

describe('member balance operation identity', () => {
  it('reuses the same key for an unconfirmed canonical amount/note and creates a new key only after confirmation', () => {
    const initial = prepareMemberBalanceOperation(11, 10, ' Offline credit ')
    expect(initial.outcomeUncertain).toBe(false)
    const retry = prepareMemberBalanceOperation(11, 10, 'Offline credit')
    expect(retry.outcomeUncertain).toBe(true)
    expect(retry.key).toBe(initial.key)
    expect(sessionStorage.getItem(initial.storageKey!)).toBe(initial.key)
    completeMemberBalanceOperation(retry)
    expect(sessionStorage.getItem(initial.storageKey!)).toBeNull()
    const newIntent = prepareMemberBalanceOperation(11, 10, 'Offline credit')
    expect(newIntent.key).not.toBe(initial.key)
    expect(newIntent.outcomeUncertain).toBe(false)
  })

  it('keeps different member, amount, note, and administrator operations separate', () => {
    const initial = prepareMemberBalanceOperation(11, 10, 'Offline credit')
    expect(prepareMemberBalanceOperation(12, 10, 'Offline credit').key).not.toBe(initial.key)
    expect(prepareMemberBalanceOperation(11, 20, 'Offline credit').key).not.toBe(initial.key)
    expect(prepareMemberBalanceOperation(11, 10, 'Another credit').key).not.toBe(initial.key)
    localStorage.setItem('auth_user', JSON.stringify({ id: ++adminIdentity }))
    expect(prepareMemberBalanceOperation(11, 10, 'Offline credit').key).not.toBe(initial.key)
  })

  it('does not persist an operation under an unknown or invalid administrator identity', () => {
    localStorage.setItem('auth_user', '{broken')
    const operation = prepareMemberBalanceOperation(11, 10, 'Offline credit')
    expect(operation.storageKey).toBeNull()
    expect(operation.key).toContain('carpool-balance-unknown-')
    expect(() => completeMemberBalanceOperation(operation)).not.toThrow()
  })

  it('recovers the pending key from session storage after its module is reloaded', async () => {
    const original = prepareMemberBalanceOperation(11, 10, 'Offline credit')
    vi.resetModules()
    const reloaded = await import('../memberBalanceOperation')
    const recovered = reloaded.prepareMemberBalanceOperation(11, 10, 'Offline credit')
    expect(recovered.key).toBe(original.key)
    expect(recovered.outcomeUncertain).toBe(true)
    reloaded.completeMemberBalanceOperation(recovered)
  })
})
