import { getUserId } from './instanceStorage'

const WEB_STORAGE_PREFIX = 'local_templates_'

function generateObjectId() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function readFromPlatform(userId) {
  if (!userId) return []

  if (window.electronAPI?.getTemplates) {
    const result = await window.electronAPI.getTemplates({ userId })
    return result?.success ? result.templates || [] : []
  }

  try {
    const raw = localStorage.getItem(`${WEB_STORAGE_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function writeToPlatform(userId, templates) {
  if (!userId) return { success: false }

  if (window.electronAPI?.saveTemplates) {
    return window.electronAPI.saveTemplates({ userId, templates })
  }

  localStorage.setItem(`${WEB_STORAGE_PREFIX}${userId}`, JSON.stringify(templates))
  return { success: true }
}

export async function getAllTemplates(user, { page = 0, limit = 100, search } = {}) {
  const userId = getUserId(user)
  if (!userId) return { status: true, templates: [], total: 0 }

  let templates = await readFromPlatform(userId)
  templates = templates.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    templates = templates.filter((t) => t.name?.toLowerCase().includes(q))
  }

  const total = templates.length
  const skip = page * limit
  const pageItems = templates.slice(skip, skip + limit)

  return { status: true, templates: pageItems, total }
}

export async function getTemplateById(user, templateId) {
  const userId = getUserId(user)
  if (!userId || !templateId) return null
  const templates = await readFromPlatform(userId)
  return templates.find((t) => t._id === templateId) || null
}

export async function createTemplate(user, { name, messageType, template }) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const now = new Date().toISOString()
  const newTemplate = {
    _id: generateObjectId(),
    userId,
    name: name?.trim() || 'Template',
    messageType: messageType || 'Text',
    template: template || {},
    createdAt: now,
    updatedAt: now,
  }

  const templates = await readFromPlatform(userId)
  await writeToPlatform(userId, [newTemplate, ...templates])

  return {
    status: true,
    message: 'Template created successfully',
    data: newTemplate,
  }
}

export async function updateTemplate(user, templateId, { name, messageType, template }) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const templates = await readFromPlatform(userId)
  const index = templates.findIndex((t) => t._id === templateId)
  if (index === -1) return { status: false, message: 'Template not found' }

  templates[index] = {
    ...templates[index],
    ...(name !== undefined ? { name } : {}),
    ...(messageType !== undefined ? { messageType } : {}),
    ...(template !== undefined ? { template } : {}),
    updatedAt: new Date().toISOString(),
  }

  await writeToPlatform(userId, templates)
  return { status: true, message: 'Template updated successfully', data: templates[index] }
}

export async function deleteTemplate(user, templateId) {
  const userId = getUserId(user)
  if (!userId) throw new Error('User not found')

  const templates = await readFromPlatform(userId)
  await writeToPlatform(
    userId,
    templates.filter((t) => t._id !== templateId)
  )
  return { status: true, message: 'Template deleted successfully' }
}
