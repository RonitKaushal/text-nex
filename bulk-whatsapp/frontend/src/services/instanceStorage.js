import api from './api'
import { getStorageKey, getMongoUserId, shouldLogoutOnAuthError } from './userStorageKey'

const WEB_STORAGE_PREFIX = 'local_instances_'

let limitCache = { userId: null, value: null, at: 0 }
const LIMIT_CACHE_TTL_MS = 3000

function limitFromUser(user) {
  const n = Number(user?.instances)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function clearInstanceLimitCache() {
  limitCache = { userId: null, value: null, at: 0 }
}

/** Always prefer MongoDB value via /user/profile; never default to 10. */
export async function resolveInstanceLimit(user, { forceRefresh = false } = {}) {
  const userId = getUserId(user)
  const now = Date.now()

  if (
    !forceRefresh &&
    userId &&
    limitCache.userId === userId &&
    limitCache.value !== null &&
    now - limitCache.at < LIMIT_CACHE_TTL_MS
  ) {
    return limitCache.value
  }

  try {
    const response = await api.get('/user/profile')
    const limit = Number(response.data?.user?.instances)
    if (Number.isFinite(limit) && limit >= 0) {
      limitCache = { userId, value: limit, at: now }
      return limit
    }
  } catch (e) {
    if (shouldLogoutOnAuthError(e)) {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    console.warn('Could not fetch instance limit from server:', e.message)
  }

  const fromUser = limitFromUser(user)
  if (fromUser !== null) {
    limitCache = { userId, value: fromUser, at: now }
    return fromUser
  }

  // Strict fallback: block extra creates rather than allow unlimited
  return 0
}

export function getUserId(user) {
  return getStorageKey(user)
}

export function getUserMongoId(user) {
  return getMongoUserId(user)
}

function generateObjectId() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function generateToken() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

async function readFromPlatform(userId) {
  if (!userId) return []

  if (window.electronAPI?.getInstances) {
    const result = await window.electronAPI.getInstances({ userId })
    return result?.success ? result.instances || [] : []
  }

  try {
    const raw = localStorage.getItem(`${WEB_STORAGE_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function writeToPlatform(userId, instances) {
  if (!userId) return { success: false }

  if (window.electronAPI?.saveInstances) {
    return window.electronAPI.saveInstances({ userId, instances })
  }

  localStorage.setItem(`${WEB_STORAGE_PREFIX}${userId}`, JSON.stringify(instances))
  return { success: true }
}

async function migrateFromServerIfEmpty(userId) {
  return []
}

export async function getAllInstances(user, { migrate = true } = {}) {
  const userId = getUserId(user)
  if (!userId) return []

  let instances = await readFromPlatform(userId)
  if (migrate && instances.length === 0) {
    instances = await migrateFromServerIfEmpty(userId)
  }

  instances = instances.sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  )

  const limit = await resolveInstanceLimit(user)
  if (instances.length > limit) {
    const trimmed = instances.slice(0, limit)
    await writeToPlatform(userId, trimmed)
    return trimmed
  }

  return instances
}

export async function createInstance(user, { name, loginType = 'QR' }) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const limit = await resolveInstanceLimit(user, { forceRefresh: true })
  const instances = await readFromPlatform(userId)

  if (instances.length >= limit) {
    return {
      success: false,
      message: `Instance limit reached. You have ${instances.length} instance(s). Your limit is ${limit}.`,
    }
  }

  const now = new Date().toISOString()
  const newInstance = {
    _id: generateObjectId(),
    userId: getMongoUserId(user) || getStorageKey(user),
    name: name?.trim() || 'whatsapp-instance',
    loginType,
    token: generateToken(),
    whatsapp: { status: 'disconnected', name: ' ' },
    createdAt: now,
    updatedAt: now,
  }

  await writeToPlatform(userId, [...instances, newInstance])
  return { success: true, instance: newInstance }
}

export async function updateInstance(user, instanceId, updates) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const instances = await readFromPlatform(userId)
  const index = instances.findIndex((i) => i._id === instanceId)
  if (index === -1) return { success: false, message: 'Instance not found' }

  instances[index] = {
    ...instances[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await writeToPlatform(userId, instances)
  return { success: true, instance: instances[index] }
}

export async function deleteLocalInstance(user, instanceId) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const instances = await readFromPlatform(userId)
  const filtered = instances.filter((i) => i._id !== instanceId)
  await writeToPlatform(userId, filtered)
  return { success: true }
}

export async function syncInstanceFromSocket(user, data) {
  const userId = getUserId(user)
  if (!userId || !data?.instanceId) return

  const instances = await readFromPlatform(userId)
  const index = instances.findIndex((i) => i._id === data.instanceId)
  if (index === -1) return

  instances[index] = {
    ...instances[index],
    name: data.name ?? instances[index].name,
    whatsapp: {
      ...instances[index].whatsapp,
      phone: data.whatsapp?.phone ?? instances[index].whatsapp?.phone,
      status: data.whatsapp?.status ?? instances[index].whatsapp?.status,
      profile: data.whatsapp?.profile ?? instances[index].whatsapp?.profile,
      name: data.whatsapp?.name ?? instances[index].whatsapp?.name,
    },
    createdAt: data.createdAt ?? instances[index].createdAt,
    updatedAt: new Date().toISOString(),
  }

  await writeToPlatform(userId, instances)
  return instances[index]
}
