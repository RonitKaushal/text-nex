import { getUserId } from './instanceStorage'
import { getAllInstances } from './instanceStorage'
import { getAllTemplates } from './templateStorage'

function normalizeStatus(value) {
  return String(value || 'pending').toLowerCase()
}

function countryLabelFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return 'Unknown'
  if (digits.startsWith('91') && digits.length >= 12) return 'India (+91)'
  if (digits.startsWith('1') && digits.length >= 11) return 'USA/Canada (+1)'
  if (digits.startsWith('44')) return 'UK (+44)'
  if (digits.startsWith('971')) return 'UAE (+971)'
  if (digits.startsWith('92')) return 'Pakistan (+92)'
  if (digits.startsWith('880')) return 'Bangladesh (+880)'
  if (digits.length >= 10) return `+${digits.slice(0, 2)}`
  return 'Other'
}

async function computeInRenderer(user) {
  const userId = getUserId(user)
  if (!userId) {
    return { status: false, message: 'User not found', statistics: null, countries: [], campaignSummary: null }
  }

  const [instances, campaignsResult, templatesResult] = await Promise.all([
    getAllInstances(user, { migrate: false }),
    window.electronAPI?.getCampaigns
      ? window.electronAPI.getCampaigns({ userId }).then((r) => r?.campaigns || [])
      : Promise.resolve([]),
    getAllTemplates(user, { limit: 500 }),
  ])

  const campaigns = Array.isArray(campaignsResult) ? campaignsResult : []
  const templates = templatesResult?.templates || []

  const totalInstances = instances.length
  const connectedInstances = instances.filter(
    (i) => normalizeStatus(i?.whatsapp?.status) === 'connected'
  ).length

  let pending = 0
  let delivered = 0
  let failed = 0
  let invalid = 0
  let instanceDisconnected = 0
  let paused = 0
  let cancelled = 0
  const countryCounts = {}

  for (const camp of campaigns) {
    const campStatus = normalizeStatus(camp.status)
    const recipients = Array.isArray(camp.recipients) ? camp.recipients : []

    for (const rec of recipients) {
      const st = normalizeStatus(rec.status)
      const phone = rec.phone || rec.number || ''

      if (st === 'pending') {
        pending++
        if (campStatus === 'paused') paused++
      } else if (st === 'sent') delivered++
      else if (st === 'failed') failed++
      else if (st === 'not_exist') invalid++
      else if (st === 'instance_disconnected') instanceDisconnected++

      if (campStatus === 'stop' && st !== 'sent') cancelled++

      const country = countryLabelFromPhone(phone)
      countryCounts[country] = (countryCounts[country] || 0) + 1
    }
  }

  return {
    status: true,
    statistics: {
      totalMessages: pending + delivered + failed + invalid + instanceDisconnected,
      connectedInstances,
      disconnectedInstances: totalInstances - connectedInstances,
      totalInstances,
      totalTemplates: templates.length,
      autoReply: 0,
      welcomeMessages: 0,
      totalCampaigns: campaigns.length,
      delivered,
      failed,
      pending,
      paused,
      cancelled,
      invalid,
      instanceDisconnected,
      totalReceivedMessages: 0,
    },
    countries: Object.entries(countryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    campaignSummary: {
      total: campaigns.length,
      active: campaigns.filter((c) => ['processing', 'pending'].includes(normalizeStatus(c.status))).length,
      completed: campaigns.filter((c) => normalizeStatus(c.status) === 'completed').length,
      paused: campaigns.filter((c) => normalizeStatus(c.status) === 'paused').length,
      stopped: campaigns.filter((c) => normalizeStatus(c.status) === 'stop').length,
    },
  }
}

export async function fetchLocalStatistics(user) {
  const userId = getUserId(user)
  if (window.electronAPI?.getDashboardStatistics) {
    return window.electronAPI.getDashboardStatistics({ userId })
  }
  return computeInRenderer(user)
}

export function isLocalDashboard() {
  return !!(typeof window !== 'undefined' && window.electronAPI?.getDashboardStatistics)
}
