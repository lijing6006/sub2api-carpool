export interface MemberBalanceOperation {
  key: string
  storageKey: string | null
  outcomeUncertain: boolean
}

const pendingKeys = new Map<string, string>()

function adminId(): number | null {
  try {
    const user = JSON.parse(globalThis.localStorage?.getItem('auth_user') ?? 'null') as { id?: unknown } | null
    return typeof user?.id === 'number' && Number.isSafeInteger(user.id) && user.id > 0 ? user.id : null
  } catch {
    return null
  }
}

function readKey(key: string): string | null {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function storeKey(key: string, value: string | null): void {
  try {
    if (value) globalThis.sessionStorage?.setItem(key, value)
    else globalThis.sessionStorage?.removeItem(key)
  } catch {
    // Same-session retries remain safe in memory when browser storage is unavailable.
  }
}

/** One canonical balance adjustment keeps its key until the server confirms success. */
export function prepareMemberBalanceOperation(userId: number, amount: number, note: string): MemberBalanceOperation {
  const actor = adminId()
  // Admin-scoped storage avoids replaying another administrator's operation after a login switch.
  const storageKey = actor ? `sub2api:carpool:balance:${actor}:${JSON.stringify([userId, amount, note.trim()])}` : null
  let key = storageKey ? pendingKeys.get(storageKey) ?? readKey(storageKey) : null
  const outcomeUncertain = !!key
  if (!key) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    key = `carpool-balance-${actor ?? 'unknown'}-${requestId}`
  }
  if (storageKey) {
    pendingKeys.set(storageKey, key)
    storeKey(storageKey, key)
  }
  return { key, storageKey, outcomeUncertain }
}

export function completeMemberBalanceOperation(operation: MemberBalanceOperation): void {
  if (!operation.storageKey) return
  pendingKeys.delete(operation.storageKey)
  storeKey(operation.storageKey, null)
}
