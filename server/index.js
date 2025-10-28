require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')

const app = express()
const PORT = process.env.PORT || 4000

// AWS S3 Configuration
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'my-upload-bucket-zip'

// Initialize S3 client for AWS S3
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
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
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB limit
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

// List files from staging folder
app.get('/staging-files', async (req, res) => {
  try {
    // Check if AWS S3 credentials are configured
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.error('AWS S3 credentials not configured')
      return res.status(500).json({ error: 'AWS S3 storage not configured' })
    }

    // List objects in staging folder
    const listParams = {
      Bucket: S3_BUCKET_NAME,
      Prefix: 'staging/',
    }

    console.log('Listing files from staging folder:', listParams.Prefix)
    const listResult = await s3Client.send(new ListObjectsV2Command(listParams))

    const files = (listResult.Contents || []).map(obj => ({
      key: obj.Key,
      filename: obj.Key.replace('staging/', ''),
      size: obj.Size,
      lastModified: obj.LastModified,
      etag: obj.ETag,
      url: `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${obj.Key}`,
    }))

    console.log(`Found ${files.length} files in staging folder`)
    return res.json({ files })
  } catch (error) {
    console.error('Error listing staging files:', error)
    return res.status(500).json({ error: 'Failed to list staging files', details: error.message })
  }
})

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
    
    // Check if AWS S3 credentials are configured
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.error('AWS S3 credentials not configured')
      return res.status(500).json({ error: 'AWS S3 storage not configured' })
    }
    
    // Read the uploaded file
    const fileBuffer = fs.readFileSync(req.file.path)
    
    // Upload to AWS S3
    const uploadParams = {
      Bucket: S3_BUCKET_NAME,
      Key: `uploads/${req.file.filename}`,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    }
    
    console.log('Uploading to S3:', uploadParams.Key)
    const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams))
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path)
    
    const result = {
      filename: req.file.filename,
      s3Key: uploadParams.Key,
      s3Url: `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${uploadParams.Key}`,
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
  console.log(`S3 Bucket: ${S3_BUCKET_NAME}`)
  console.log(`AWS Region: ${AWS_REGION}`)
  console.log(`S3 configured: ${!!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY)}`)
})


