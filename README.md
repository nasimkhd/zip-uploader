# Large File Upload Architecture

A modern, scalable file upload system built with Cloudflare Workers and R2, supporting files up to 5GB with multipart uploads.

## Architecture Overview

This project implements a **two-worker architecture** for optimal performance and separation of concerns:

- **Backend Worker** (`zip-uploader-worker`): Handles file uploads using R2 bindings
- **Frontend Worker** (`zip-uploader-frontend`): Provides modern UI and upload orchestration
  

## Features

### ✅ Modern Architecture
- **R2 Bindings**: Direct access to R2 without API keys
- **Multipart Uploads**: Support for files up to 5GB
- **Concurrent Uploads**: 5 parallel chunk uploads
- **Resume Capability**: Automatic retry for failed chunks
- **Progress Tracking**: Real-time upload progress

### ✅ Security & Performance
- **File Validation**: Type and size validation
- **Error Handling**: Comprehensive error recovery
- **CORS Support**: Cross-origin request handling
- **Streaming**: Memory-efficient file processing

### ✅ User Experience
- **Modern UI**: Clean, responsive interface
- **Drag & Drop**: Intuitive file selection
- **Progress Indicators**: Visual upload feedback
- **File Management**: View and delete uploaded files

## Quick Start

### 1. Deploy Backend Worker

```bash
cd backend-worker
wrangler deploy
```

### 2. Deploy Frontend Worker

```bash
cd frontend-worker
# Update BACKEND_WORKER_URL in wrangler.toml
wrangler deploy
```

### 3. Configure R2 Bucket

```bash
# Set up R2 binding in backend-worker/wrangler.toml
[[r2_buckets]]
binding = "R2_BUCKET_NAME"
bucket_name = "your-bucket-name"
```

## Configuration

### Backend Worker (zip-uploader-worker)

**wrangler.toml:**
```toml
name = "zip-uploader-worker"
main = "src/index.js"

[[r2_buckets]]
binding = "R2_BUCKET_NAME"
bucket_name = "kampus-incoming"

[vars]
MAX_FILE_SIZE = "5368709120"  # 5GB
CHUNK_SIZE = "8388608"        # 8MB
MAX_CONCURRENT_UPLOADS = "5"
```

### Frontend Worker (zip-uploader-frontend)

**wrangler.toml:**
```toml
name = "zip-uploader-frontend"
main = "src/index.js"

[vars]
BACKEND_WORKER_URL = "https://zip-uploader-worker.andrea-4a3..workers.dev"
```

## API Endpoints

### Backend Worker

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload` | Simple upload (< 100MB) |
| `POST` | `/api/upload/multipart/init` | Initiate multipart upload |
| `POST` | `/api/upload/multipart/part` | Upload chunk |
| `POST` | `/api/upload/multipart/complete` | Complete multipart upload |
| `POST` | `/api/upload/multipart/abort` | Abort multipart upload |
| `GET` | `/api/files` | List uploaded files |
| `DELETE` | `/api/files/{key}` | Delete file |

### Frontend Worker

| Route | Description |
|-------|-------------|
| `/` or `/upload` | Upload interface |
| `/files` | File management interface |

## Upload Strategies

### Simple Upload (Files < 100MB)
- Direct upload through Worker
- Single request
- Fast for small files

### Multipart Upload (Files 1-5GB)
- Chunked upload with 8MB parts
- 5 concurrent uploads
- Resume capability
- Progress tracking

## File Size Limits

| Strategy | Max Size | Chunk Size | Concurrent |
|----------|----------|------------|------------|
| Simple | 100MB | N/A | 1 |
| Multipart | 5GB | 8MB | 5 |

## Security

### File Validation
- ZIP files only
- Size limits enforced
- MIME type validation

### CORS
- Configured for cross-origin requests
- Preflight request handling

## Development

### Local Development

```bash
# Backend worker
cd backend-worker
wrangler dev

# Frontend worker
cd frontend-worker
wrangler dev
```

### Testing

```bash
# Health check
curl https://your-backend-worker.workers.dev/api/health

# Upload test
curl -X POST https://your-backend-worker.workers.dev/api/upload \
  -F "file=@test.zip"
```

## Migration from Legacy

The original monolithic worker has been replaced with:

1. **Backend Worker**: Handles all R2 operations using bindings
2. **Frontend Worker**: Provides modern UI and upload orchestration

### Benefits of New Architecture

- **Better Performance**: R2 bindings are faster than API calls
- **Scalability**: Independent scaling of frontend and backend
- **Security**: No API keys exposed to frontend
- **Maintainability**: Clear separation of concerns
- **Features**: Multipart uploads, progress tracking, resume capability

## Troubleshooting

### Common Issues

1. **R2 Binding Not Working**
   - Check `wrangler.toml` configuration
   - Verify bucket name and binding name
   - Ensure worker has R2 permissions

2. **Upload Failures**
   - Verify file size limits
   - Check network connectivity

3. **CORS Errors**
   - Verify CORS headers in responses
   - Check preflight request handling

### Debug Mode

Enable detailed logging by adding to your worker:

```javascript
console.log('Debug info:', { key, uploadId, partNumber });
```

## Performance Optimization

### Chunk Size Tuning
- **8MB**: Good balance for most connections
- **16MB**: Better for fast connections
- **4MB**: Better for slow connections

### Concurrency Tuning
- **5 concurrent**: Recommended default
- **3 concurrent**: For slower connections
- **10 concurrent**: For very fast connections (use with caution)

## Monitoring

### Key Metrics
- Upload success rate
- Average upload time
- Chunk upload failures
- Multipart completion rate

### Logging
- Upload initiation events
- Chunk upload success/failure
- Multipart completion
- Error details with context

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Cloudflare Workers documentation
3. Check R2 bindings documentation
4. Open an issue in this repository





# 1) Ensure AWS CLI is installed
# brew install awscli

# 2) Set your R2 credentials (replace with your actual keys)
export AWS_ACCESS_KEY_ID="YOUR_R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_R2_SECRET_ACCESS_KEY"
export AWS_REGION="auto"  # or "us-east-1"

# 3) Define endpoint and bucket
ENDPOINT="https://4a376646b3e39a27c7c4a28ff40f9deb.r2.cloudflarestorage.com"
BUCKET="kampus-incoming"

# 4) Delete everything under the prefixes
aws s3 rm "s3://$BUCKET/unzipped/" --recursive --endpoint-url "$ENDPOINT"
aws s3 rm "s3://$BUCKET/uploads/" --recursive --endpoint-url "$ENDPOINT"
aws s3 rm "s3://$BUCKET/upload/"  --recursive --endpoint-url "$ENDPOINT"

# 5) Verify emptiness (each should show nothing)
aws s3 ls "s3://$BUCKET/unzipped/" --endpoint-url "$ENDPOINT"
aws s3 ls "s3://$BUCKET/uploads/"  --endpoint-url "$ENDPOINT"
aws s3 ls "s3://$BUCKET/upload/"   --endpoint-url "$ENDPOINT"



ENDPOINT="https://4a376646b3e39a27c7c4a28ff40f9deb.r2.cloudflarestorage.com"
BUCKET="kampus-incoming"
PREFIX="uploads/"


See what’s still ongoing

aws s3api list-multipart-uploads \
  --bucket "$BUCKET" \
  --endpoint-url "$ENDPOINT" \
  --region auto \
  --prefix "$PREFIX" \
  --query 'Uploads[].{Key:Key,UploadId:UploadId,Initiated:Initiated}' \
  --output table


### Abort all (loop until none remain)

  while :; do
  uploads=$(aws s3api list-multipart-uploads \
    --bucket "$BUCKET" \
    --endpoint-url "$ENDPOINT" \
    --region auto \
    --prefix "$PREFIX" \
    --query 'Uploads[].{Key:Key,UploadId:UploadId}' \
    --output text)

  [ -z "$uploads" ] && break

  while read -r key uploadId; do
    [ -z "$key" ] && continue
    aws s3api abort-multipart-upload \
      --bucket "$BUCKET" \
      --key "$key" \
      --upload-id "$uploadId" \
      --endpoint-url "$ENDPOINT" \
      --region auto >/dev/null || true
  done <<< "$uploads"
done