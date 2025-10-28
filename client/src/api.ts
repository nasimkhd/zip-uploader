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


