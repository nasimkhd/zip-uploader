import { useState, useEffect } from 'react'
import { getStagingFiles, type StagingFile } from './api'

function StagingFiles() {
  const [files, setFiles] = useState<StagingFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const loadStagingFiles = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await getStagingFiles()
      setFiles(result.files)
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error?.message ?? 'Failed to load staging files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStagingFiles()
  }, [])

  return (
    <div className="staging-container">
      <h1 className="staging-title">Staging Files</h1>
      <div className="refresh-container">
        <button onClick={loadStagingFiles} disabled={loading} className="refresh-button">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        {!loading && files.length > 0 && (
          <div className="files-count">
            Found {files.length} file{files.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="loading-message">
          Loading staging files...
        </div>
      ) : files.length === 0 ? (
        <div className="no-files-message">
          No files found in staging folder.
        </div>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.key}>
                <td>
                  {file.filename}
                </td>
                <td>
                  {formatFileSize(file.size)}
                </td>
                <td>
                  {formatDate(file.lastModified)}
                </td>
                <td>
                  <div className="action-buttons">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="download-link"
                    >
                      Download
                    </a>
                    <button 
                      onClick={() => window.open(file.url, '_blank')}
                      className="view-button"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default StagingFiles
