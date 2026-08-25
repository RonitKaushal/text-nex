import {
  getAllCampaigns as storageGetAll,
  getCampaignById,
  createCampaign as storageCreate,
  deleteCampaign as storageDelete,
  updateCampaign,
} from './campaignStorage'
import { getUserId } from './instanceStorage'

export function isLocalCampaignMode() {
  return typeof window !== 'undefined' && !!window.electronAPI
}

export async function listCampaigns(user, options = {}) {
  return storageGetAll(user, options)
}

export async function fetchCampaignById(user, campaignId) {
  const campaign = await getCampaignById(user, campaignId)
  if (!campaign) {
    return { status: false, message: 'Campaign not found' }
  }
  return { status: true, message: campaign }
}

export async function createCampaign(user, data) {
  return storageCreate(user, data)
}

export async function deleteCampaign(user, campaignId) {
  return storageDelete(user, campaignId)
}

export async function sendCampaign(user, campaignId) {
  const userId = getUserId(user)
  if (window.electronAPI?.campaignSend) {
    return window.electronAPI.campaignSend({ userId, campaignId })
  }
  return { status: false, message: 'Campaign send is only available in the desktop app' }
}

export async function pauseCampaign(user, campaignId) {
  if (window.electronAPI?.campaignPause) {
    return window.electronAPI.campaignPause({ campaignId })
  }
  return updateCampaign(user, campaignId, { status: 'paused' })
}

export async function resumeCampaign(user, campaignId) {
  if (window.electronAPI?.campaignResume) {
    return window.electronAPI.campaignResume({ campaignId })
  }
  return updateCampaign(user, campaignId, { status: 'processing' })
}

export async function stopCampaign(user, campaignId) {
  if (window.electronAPI?.campaignStop) {
    return window.electronAPI.campaignStop({ campaignId })
  }
  return updateCampaign(user, campaignId, { status: 'stop' })
}
