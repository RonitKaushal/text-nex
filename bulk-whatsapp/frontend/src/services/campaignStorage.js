import { getUserId } from './instanceStorage'

const WEB_STORAGE_PREFIX = 'local_campaigns_'

function generateObjectId() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function readFromPlatform(userId) {
  if (!userId) return []

  if (window.electronAPI?.getCampaigns) {
    const result = await window.electronAPI.getCampaigns({ userId })
    return result?.success ? result.campaigns || [] : []
  }

  try {
    const raw = localStorage.getItem(`${WEB_STORAGE_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function writeToPlatform(userId, campaigns) {
  if (!userId) return { success: false }

  if (window.electronAPI?.saveCampaigns) {
    return window.electronAPI.saveCampaigns({ userId, campaigns })
  }

  localStorage.setItem(`${WEB_STORAGE_PREFIX}${userId}`, JSON.stringify(campaigns))
  return { success: true }
}

function setNested(obj, path, value) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const idx = Number(key)
    if (Number.isInteger(idx) && String(idx) === key) {
      if (!Array.isArray(cur)) return
      if (!cur[idx]) cur[idx] = {}
      cur = cur[idx]
    } else {
      if (cur[key] == null) cur[key] = {}
      cur = cur[key]
    }
  }
  const last = parts[parts.length - 1]
  const lastIdx = Number(last)
  if (Number.isInteger(lastIdx) && String(lastIdx) === last) {
    cur[lastIdx] = value
  } else {
    cur[last] = value
  }
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

export function applyMongoUpdate(campaign, update) {
  if (!campaign || !update) return campaign

  if (update.$set) {
    for (const [key, val] of Object.entries(update.$set)) {
      setNested(campaign, key, val)
    }
  }

  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      const current = Number(getNested(campaign, key)) || 0
      setNested(campaign, key, current + Number(val))
    }
  }

  if (update.status) {
    campaign.status = update.status
  }

  campaign.updatedAt = new Date().toISOString()
  return campaign
}

export async function getAllCampaigns(user, { page = 0, limit = 10, search, status } = {}) {
  const userId = getUserId(user)
  if (!userId) return { status: true, total: 0, cumulativeStats: { total: 0, sent: 0, failed: 0 }, messages: [] }

  let campaigns = await readFromPlatform(userId)
  campaigns = campaigns.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )

  if (status && status !== 'all') {
    campaigns = campaigns.filter((c) => c.status === status)
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    campaigns = campaigns.filter((c) => c.name?.toLowerCase().includes(q))
  }

  const cumulativeStats = campaigns.reduce(
    (acc, c) => ({
      total: acc.total + (c.statistics?.total || c.recipients?.length || 0),
      sent: acc.sent + (c.statistics?.sent || 0),
      failed: acc.failed + (c.statistics?.failed || 0),
    }),
    { total: 0, sent: 0, failed: 0 }
  )

  const total = campaigns.length
  const skip = page * limit
  const pageItems = campaigns.slice(skip, skip + limit).map((c) => {
    const { recipients, ...rest } = c
    return {
      ...rest,
      recipients: recipients?.map((r) => ({ status: r.status })) || [],
    }
  })

  return { status: true, total, cumulativeStats, messages: pageItems }
}

export async function getCampaignById(user, campaignId) {
  const userId = getUserId(user)
  if (!userId || !campaignId) return null
  const campaigns = await readFromPlatform(userId)
  return campaigns.find((c) => c._id === campaignId) || null
}

export async function createCampaign(user, data) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const {
    name,
    templateId,
    templateSnapshot,
    instanceIds = [],
    recipients = [],
    delayRange = { start: 3, end: 5 },
  } = data

  const now = new Date().toISOString()
  const campaignRecipients = recipients.map((rec) => ({
    phone: rec.phone,
    name: rec.name || 'User',
    status: 'pending',
    ...(rec.variables ? { variables: rec.variables } : {}),
  }))

  const newCampaign = {
    _id: generateObjectId(),
    userId,
    name: name?.trim() || 'Campaign',
    templateId: templateSnapshot || templateId,
    instanceIds,
    recipients: campaignRecipients,
    settings: { delayRange },
    delayRange,
    status: 'pending',
    statistics: {
      total: campaignRecipients.length,
      sent: 0,
      failed: 0,
      notExist: 0,
      instanceDisconnected: 0,
    },
    createdAt: now,
    updatedAt: now,
  }

  const campaigns = await readFromPlatform(userId)
  await writeToPlatform(userId, [newCampaign, ...campaigns])

  return {
    status: true,
    message: 'Campaign created successfully',
    campaignId: newCampaign._id,
    campaign: newCampaign,
  }
}

export async function updateCampaign(user, campaignId, updates) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const campaigns = await readFromPlatform(userId)
  const index = campaigns.findIndex((c) => c._id === campaignId)
  if (index === -1) return { status: false, message: 'Campaign not found' }

  campaigns[index] = {
    ...campaigns[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await writeToPlatform(userId, campaigns)
  return { status: true, campaign: campaigns[index] }
}

export async function applyCampaignUpdate(user, campaignId, mongoUpdate) {
  const userId = getUserId(user)
  if (!userId) return null

  const campaigns = await readFromPlatform(userId)
  const index = campaigns.findIndex((c) => c._id === campaignId)
  if (index === -1) return null

  applyMongoUpdate(campaigns[index], mongoUpdate)
  await writeToPlatform(userId, campaigns)
  return campaigns[index]
}

export async function deleteCampaign(user, campaignId) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const campaigns = await readFromPlatform(userId)
  const filtered = campaigns.filter((c) => c._id !== campaignId)
  await writeToPlatform(userId, filtered)
  return { status: true, message: 'Campaign deleted successfully' }
}
