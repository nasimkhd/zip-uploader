export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export async function uploadZip(file: File): Promise<{ filename: string; path: string }> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    let message = 'Upload failed'
    try {
      message = await response.text()
    } catch (e) {
      // ignore
    }
    throw new Error(message || `Upload failed with status ${response.status}`)
  }

  return response.json()
}

export interface StagingFile {
  key: string
  filename: string
  size: number
  lastModified: string
  etag: string
  url: string
}

export async function getStagingFiles(): Promise<{ files: StagingFile[] }> {
  const response = await fetch(`${API_BASE_URL}/staging-files`, {
    method: 'GET',
  })

  if (!response.ok) {
    let message = 'Failed to fetch staging files'
    try {
      const errorData = await response.json()
      message = errorData.error || message
    } catch (e) {
      // ignore
    }
    throw new Error(message || `Failed to fetch staging files with status ${response.status}`)
  }

  return response.json()
}


