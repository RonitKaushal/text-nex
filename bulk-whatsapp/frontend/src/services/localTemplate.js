import {
  getAllTemplates as storageGetAll,
  getTemplateById,
  createTemplate as storageCreate,
  updateTemplate as storageUpdate,
  deleteTemplate as storageDelete,
} from './templateStorage'

export async function listTemplates(user, options = {}) {
  return storageGetAll(user, options)
}

export async function fetchTemplateById(user, templateId) {
  const template = await getTemplateById(user, templateId)
  if (!template) return { status: false, message: 'Template not found' }
  return { status: true, data: template }
}

export async function createTemplate(user, payload) {
  return storageCreate(user, payload)
}

export async function editTemplate(user, templateId, payload) {
  return storageUpdate(user, templateId, payload)
}

export async function deleteTemplate(user, templateId) {
  return storageDelete(user, templateId)
}

/** Normalize stored path for display in Electron renderer */
export function getMediaDisplayUrl(url) {
  if (!url) return ''
  if (url.startsWith('local-media://')) return url
  if (url.startsWith('file://')) {
    const name = url.split(/[/\\]/).pop()
    return name ? `local-media://${name}` : url
  }
  return url
}

export async function uploadTemplateMedia(file) {
  if (!file) {
    return { status: false, message: 'No media file provided' }
  }

  if (file.size > 20 * 1024 * 1024) {
    return { status: false, message: 'File size too large. Maximum 20MB allowed' }
  }

  const allowed =
    file.type?.startsWith('image/') ||
    file.type?.startsWith('video/') ||
    file.type?.startsWith('audio/') ||
    file.type === 'application/pdf'

  if (!allowed) {
    return { status: false, message: 'Unsupported file type. Allowed: Images, Videos, Audio, PDF' }
  }

  if (window.electronAPI?.uploadTemplateMedia) {
    const buf = new Uint8Array(await file.arrayBuffer())
    return window.electronAPI.uploadTemplateMedia({
      fileName: file.name,
      mimeType: file.type,
      data: Array.from(buf),
    })
  }

  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return {
    status: true,
    message: 'Media stored locally',
    data: { url, fileName: file.name, mimeType: file.type, size: file.size },
  }
}
