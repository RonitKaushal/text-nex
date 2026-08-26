/** Local data key — phone number (stable across logins). */

export function normalizePhone(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  return digits || null
}

/** Key for instances/campaigns/templates on this device. */
export function getStorageKey(user) {
  const phone = normalizePhone(user?.phone)
  if (phone) return phone
  const legacy = user?._id || user?.id || user?.userId
  return legacy ? String(legacy) : null
}

export function getMongoUserId(user) {
  if (!user) return null
  return user._id || user.id || user.userId || null
}

/**
 * Same rules as ArcticSwitch AuthContext:
 * - User not found / invalid JWT → force login
 * - License expired / soft 403 → keep session (do NOT bounce to login)
 */
export function shouldLogoutOnAuthError(error) {
  const status = error?.response?.status
  const data = error?.response?.data || {}
  const msg = String(data.message || error?.message || '').toLowerCase()
  const code = String(data.code || '')

  if (data.isExpired === true) return false
  if (code === 'LICENSE_APP_MISMATCH') return false
  if (msg.includes('license') && (msg.includes('expired') || msg.includes('renew'))) {
    return false
  }

  if (msg.includes('user not found')) return true
  if (status === 404 && msg.includes('user')) return true

  if (
    msg.includes('token is invalid') ||
    msg.includes('token expired') ||
    msg.includes('invalid token') ||
    msg.includes('jwt')
  ) {
    return true
  }

  if (status === 401) {
    if (msg.includes('not authorized') || msg.includes('unauthorized')) return true
    if (msg.includes('user not found') || msg.includes('token')) return true
    // Soft 401 (e.g. license) — keep session
    return false
  }

  // Never treat generic 403/404 (instance missing, etc.) as session death
  return false
}
