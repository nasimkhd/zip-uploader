import { useMemo, useState } from 'react'
import './App.css'
import { uploadZip } from './api'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)

  const isZip = useMemo(() => {
    if (!file) return false
    const name = file.name.toLowerCase()
    const byExt = name.endsWith('.zip')
    const byType = file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
    return byExt || byType
  }, [file])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !isZip) {
      setMessage('Please select a .zip file.')
      return
    }
    setIsUploading(true)
    setMessage('')
    try {
      const res = await uploadZip(file)
      setMessage(`Uploaded: ${res.filename}`)
      setFile(null)
      const input = document.getElementById('zip-input') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (err: unknown) {
      const error = err as { message?: string }
      setMessage(error?.message ?? 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <h1>Zip File Uploader</h1>
      <form onSubmit={handleSubmit}>
        <input
          id="zip-input"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || !isZip || isUploading}>
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </>
  )
}

export default App
