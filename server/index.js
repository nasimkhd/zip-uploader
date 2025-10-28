const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const app = express()
const PORT = process.env.PORT || 4000

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'kampus-incoming'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://dash.cloudflare.com/4a376646b3e39a27c7c4a28ff40f9deb/r2/default/buckets/kampus-incoming'

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// Temporary directory for processing uploads
const tempDir = path.resolve(__dirname, '..', 'pipeline', 'temp')
fs.mkdirSync(tempDir, { recursive: true })

app.use(cors({ origin: true }))
app.use(morgan('dev'))

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.zip'
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_')
    const filename = `${Date.now()}-${base}${ext}`
    cb(null, filename)
  },
})

const allowedMime = new Set([
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/octet-stream',
])

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.zip' || allowedMime.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only .zip files are allowed'))
    }
  },
})

app.get('/healthz', (req, res) => res.json({ ok: true }))

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    })
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    
    // Check if R2 credentials are configured
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error('R2 credentials not configured')
      return res.status(500).json({ error: 'R2 storage not configured' })
    }
    
    // Read the uploaded file
    const fileBuffer = fs.readFileSync(req.file.path)
    
    // Upload to Cloudflare R2
    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: `uploads/${req.file.filename}`,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    }
    
    console.log('Uploading to R2:', uploadParams.Key)
    const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams))
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path)
    
    const result = {
      filename: req.file.filename,
      r2Key: uploadParams.Key,
      r2Url: `${R2_PUBLIC_URL}?prefix=uploads%2F`,
      etag: uploadResult.ETag,
    }
    
    console.log('Upload successful:', result)
    return res.json(result)
  } catch (error) {
    console.error('Upload error:', error)
    
    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    
    return res.status(500).json({ error: 'Upload failed', details: error.message })
  }
})

app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('zip')) {
    return res.status(400).json({ error: err.message })
  }
  console.error('Server Error:', err)
  console.error('Error stack:', err.stack)
  res.status(500).json({ error: 'Server error', details: err.message })
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  console.log(`Temporary directory: ${tempDir}`)
  console.log(`R2 Bucket: ${R2_BUCKET_NAME}`)
  console.log(`R2 configured: ${!!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)}`)
})


