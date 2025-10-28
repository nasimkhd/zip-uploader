import { useMemo, useState } from 'react'
import './App.css'
import { uploadZip } from './api'
import StagingFiles from './StagingFiles'

type Page = 'upload' | 'staging'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('upload')
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
    <div className="app-container">
      <nav className="nav-container">
        <div className="nav-buttons">
          <button 
            onClick={() => setCurrentPage('upload')}
            className={`nav-button ${currentPage === 'upload' ? 'active' : ''}`}
          >
            Upload Files
          </button>
          <button 
            onClick={() => setCurrentPage('staging')}
            className={`nav-button ${currentPage === 'staging' ? 'active' : ''}`}
          >
            View Staging Files
          </button>
        </div>
      </nav>

      <div className="page-content">
        {currentPage === 'upload' ? (
          <div className="upload-container">
            <h1 className="upload-title">Zip File Uploader</h1>
            <form onSubmit={handleSubmit} className="upload-form">
              <div className="file-input-container">
                <input
                  id="zip-input"
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="file-input"
                />
              </div>
              <button 
                type="submit" 
                disabled={!file || !isZip || isUploading}
                className="upload-button"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
            {message && (
              <div className={`message ${message.includes('Uploaded') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
          </div>
        ) : (
          <StagingFiles />
        )}
      </div>
    </div>
  )
}

export default App
