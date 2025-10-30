# Large File Upload Architecture & Implementation Plan

## Overview

This document outlines the architecture and best practices for implementing a scalable file upload system that allows users to upload large ZIP files (1-5 GB) to Cloudflare R2 buckets through Cloudflare Workers. The solution leverages a two-worker architecture pattern for optimal separation of concerns, security, and performance.

## Architecture Pattern: Two-Worker Design

### Current State vs. Proposed Architecture

**Current State:**
- Single Cloudflare Worker handling both frontend UI and backend API
- Files uploaded through the Worker (streaming), which consumes Worker resources
- Multipart uploads handled server-side

**Proposed Architecture:**
- **Frontend Worker**: Serves UI, handles client-side logic, manages upload orchestration
- **Backend Worker**: Handles file uploads via R2 bindings, manages multipart upload sessions, handles authentication
- **Worker-Proxied Upload**: Files upload through the Backend Worker using R2 bindings for secure access

### Benefits of Two-Worker Architecture

1. **Separation of Concerns**: Frontend and backend logic are isolated
2. **Independent Scaling**: Each worker can scale independently based on workload
3. **Security**: Backend credentials never exposed to frontend, all uploads authenticated
4. **Control**: Full control over upload validation, processing, and error handling
5. **R2 Bindings**: Direct access to R2 through Worker bindings (no API keys needed)
6. **Maintainability**: Easier to update and maintain separate codebases
7. **Consistent API**: All uploads go through your API with consistent authentication

## Component Architecture

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
         │ 1. Load UI
         ▼
┌─────────────────────────────────┐
│      Frontend Worker             │
│  - Serves HTML/CSS/JS            │
│  - File selection UI             │
│  - Upload progress tracking      │
│  - Error handling & retry logic  │
│  - File chunking                 │
└────────┬─────────────────────────┘
         │
         │ 2. Upload file chunks
         │    (via multipart API)
         ▼
┌─────────────────────────────────┐
│      Backend Worker             │
│  - Authentication/Authorization  │
│  - Initiate multipart uploads   │
│  - Stream chunks to R2          │
│  - Complete multipart uploads   │
│  - Post-upload processing       │
└────────┬─────────────────────────┘
         │
         │ 3. R2 Binding (direct)
         │
         ▼
┌─────────────────────────────────┐
│   Cloudflare R2 Bucket          │
│  - Store uploaded ZIP files      │
│  - Lifecycle policies           │
└─────────────────────────────────┘
```

## Upload Strategies

### Strategy 1: Simple Upload (Files < 100 MB)

For smaller files, upload directly through the Worker:

**Flow:**
1. Frontend Worker: User selects file
2. Frontend Worker → Backend Worker: Upload file (`POST /api/upload`)
3. Backend Worker: 
   - Authenticate request
   - Stream file to R2 using R2 binding
   - Return success response
4. Backend Worker: Post-upload processing (validation, notifications)

**Advantages:**
- Simple implementation
- Single request
- Full control over authentication and validation
- Fast for small files

**Limitations:**
- Worker CPU time consumed for file transfer
- Not optimal for very large files (>100 MB)
- No resume capability

### Strategy 2: Multipart Upload (Files 1-5 GB) - RECOMMENDED

For large files (1-5 GB), use multipart uploads with chunking through the Worker:

**Flow:**
1. Frontend Worker: User selects file
2. Frontend Worker → Backend Worker: Initiate multipart upload (`POST /api/upload/multipart/init`)
3. Backend Worker: 
   - Authenticate request
   - Initiate multipart upload with R2 using R2 binding
   - Return `uploadId` and `key`
4. Frontend Worker: 
   - Split file into chunks (recommended: 8-16 MB per chunk)
   - Upload chunks sequentially or in small batches (`POST /api/upload/multipart/part`)
5. Backend Worker: 
   - Receive chunk
   - Stream chunk to R2 using R2 binding
   - Return part ETag
6. Frontend Worker → Backend Worker: Complete upload (`POST /api/upload/multipart/complete`)
7. Backend Worker: Complete multipart upload with R2
8. Backend Worker: Post-upload processing

**Advantages:**
- Handles large files efficiently (1-5 GB)
- Resume capability (can retry failed parts)
- Better error recovery
- Progress tracking per part
- Full authentication and validation control
- No credential exposure

**Considerations:**
- Worker CPU time consumed for chunk streaming
- Use streaming API to minimize memory usage
- Implement concurrent chunk uploads (3-5 concurrent requests)

**R2 Multipart Limits:**
- Minimum part size: **5 MiB** (5,242,880 bytes)
- Maximum part size: **5 GiB** (5,368,709,120 bytes)
- Maximum parts per upload: **10,000**
- Maximum object size: **4.995 TiB** (using multipart)

**Recommended Chunk Size:**
- **8-16 MB** per chunk for files 1-5 GB
- Balances between upload speed and number of requests
- Example: 5 GB file = ~400-600 chunks at 8-16 MB each

## Implementation Details

### Frontend Worker Responsibilities

#### 1. User Interface
- File input with drag-and-drop support
- File validation (type, size)
- Progress indicators (overall and per-chunk)
- Error messages and retry buttons
- Upload queue management

#### 2. Upload Orchestration
```javascript
class UploadManager {
  async uploadFile(file) {
    // Initiate multipart upload
    const { uploadId, key } = await this.initiateUpload(file);
    
    // Split file into chunks
    const chunks = this.splitIntoChunks(file, 8 * 1024 * 1024); // 8 MB chunks
    
    // Upload chunks concurrently (limit: 3-5 concurrent)
    const parts = await this.uploadChunks(key, uploadId, chunks);
    
    // Complete upload
    await this.completeUpload(key, uploadId, parts);
  }
  
  async uploadChunks(key, uploadId, chunks) {
    const CONCURRENT_LIMIT = 5;
    const parts = [];
    
    for (let i = 0; i < chunks.length; i += CONCURRENT_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENT_LIMIT);
      const batchPromises = batch.map((chunk, index) => 
        this.uploadPart(key, uploadId, i + index + 1, chunk)
      );
      const batchResults = await Promise.allSettled(batchPromises);
      parts.push(...batchResults.map(r => r.value));
    }
    
    return parts;
  }
  
  async uploadPart(key, uploadId, partNumber, chunk) {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('key', key);
    formData.append('uploadId', uploadId);
    formData.append('partNumber', partNumber.toString());
    
    const response = await fetch('https://backend-worker.workers.dev/api/upload/multipart/part', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload part ${partNumber}`);
    }
    
    const result = await response.json();
    return { PartNumber: partNumber, ETag: result.etag };
  }
}
```

#### 3. Error Handling & Retry Logic
- Automatic retry for failed parts (exponential backoff)
- Resume incomplete uploads
- Network error detection
- Timeout handling

#### 4. Progress Tracking
- Calculate total bytes uploaded
- Update UI with progress percentage
- Show upload speed (MB/s)
- Estimate time remaining

### Backend Worker Responsibilities

#### 1. Authentication & Authorization
```javascript
async function authenticateRequest(request) {
  // Verify API key, JWT token, or session
  const apiKey = request.headers.get('X-API-Key');
  if (!isValidApiKey(apiKey)) {
    throw new Error('Unauthorized');
  }
}
```

#### 2. R2 Binding Configuration
Configure R2 binding in `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "R2_BUCKET_NAME"
bucket_name = "your-bucket-name"
```

#### 3. Multipart Upload Management Using R2 Bindings
```javascript
// Initiate multipart upload using R2 binding
async function initiateMultipartUpload(key, contentType, env) {
  const uploadId = await env.R2_BUCKET_NAME.createMultipartUpload(key, {
    httpMetadata: { contentType }
  });
  return { uploadId, key };
}

// Upload part using R2 binding
async function uploadPart(key, uploadId, partNumber, chunk, env) {
  const part = await env.R2_BUCKET_NAME.uploadPart(key, uploadId, partNumber, chunk);
  return { PartNumber: partNumber, ETag: part.etag };
}

// Complete multipart upload using R2 binding
async function completeMultipartUpload(key, uploadId, parts, env) {
  await env.R2_BUCKET_NAME.completeMultipartUpload(key, uploadId, parts);
  return { success: true, key };
}
```

#### 4. Streaming Upload Handler
```javascript
// Stream upload endpoint using R2 binding
async function handleUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  const key = `uploads/${Date.now()}-${file.name}`;
  
  // Stream directly to R2
  await env.R2_BUCKET_NAME.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });
  
  return new Response(JSON.stringify({ success: true, key }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### 5. Post-Upload Processing
- File validation
- Virus scanning (optional)
- Database updates
- Notification triggers
- Cleanup operations

### R2 Bucket Configuration

#### 1. R2 Binding Setup

Since we're using R2 bindings instead of direct client uploads, **CORS configuration is NOT required**. The Worker handles all R2 interactions directly.

**Configure R2 Binding in `wrangler.toml`:**
```toml
[[r2_buckets]]
binding = "R2_BUCKET_NAME"
bucket_name = "your-bucket-name"
```

This allows your Worker to access R2 directly without API keys or CORS configuration.

#### 2. Lifecycle Policies
- Automatic deletion of failed multipart uploads after 7 days
- Archive old files to cheaper storage tiers
- Retention policies based on business requirements

#### 3. Bucket Permissions
- Use R2 API tokens with least privilege
- Scope tokens to specific buckets
- Rotate credentials regularly

## API Endpoints

### Frontend Worker Routes

```
GET  /              → Upload page UI
GET  /upload        → Upload page UI
GET  /staging       → Staging files page
GET  /api/*         → Proxy to Backend Worker
```

### Backend Worker Routes

```
POST   /api/upload
       Request: FormData with file
       Response: { success: true, key, location }
       Description: Simple upload for files < 100 MB

POST   /api/upload/multipart/init
       Request: { filename, size, contentType }
       Response: { uploadId, key }
       Description: Initiate multipart upload

POST   /api/upload/multipart/part
       Request: FormData with chunk, key, uploadId, partNumber
       Response: { partNumber, etag, success: true }
       Description: Upload a single part/chunk

POST   /api/upload/multipart/complete
       Request: { key, uploadId, parts: [{ partNumber, etag }] }
       Response: { success: true, location, key }
       Description: Complete multipart upload

DELETE /api/upload/multipart/abort
       Request: { key, uploadId }
       Response: { success: true }
       Description: Abort incomplete multipart upload

GET    /api/upload/status
       Request: { uploadId }
       Response: { status, partsUploaded, totalParts }
       Description: Check upload status
```

## Security Considerations

### 1. Worker-Based Upload Security
- **Authentication Required**: All upload endpoints require authentication
- **Request Validation**: Validate file type, size, and metadata before processing
- **Content-Type Enforcement**: Enforce ZIP file type validation
- **Size Limits**: Validate file size before initiating upload
- **Rate Limiting**: Implement rate limiting per user/IP to prevent abuse

### 2. Authentication
- API key authentication for backend endpoints
- JWT tokens for user sessions (optional)
- Rate limiting per user/IP
- Request signing for sensitive operations

### 3. File Validation
- File type validation (MIME type + extension)
- File size limits (max 5 GB)
- Virus scanning (optional, third-party service)
- ZIP file integrity check after upload

### 4. Input Sanitization
- Sanitize filenames to prevent path traversal
- Validate and limit filenames
- Generate unique keys to prevent collisions
- Prevent malicious file patterns

## Performance Optimizations

### 1. Concurrent Uploads
- Upload multiple parts simultaneously (limit: 5-10 concurrent)
- Balance between speed and resource usage
- Adaptive concurrency based on network conditions

### 2. Chunk Size Selection
- Larger chunks (16-32 MB) for good connections
- Smaller chunks (8 MB) for unreliable connections
- Dynamic adjustment based on upload speed

### 3. Resume Capability
- Store upload state in IndexedDB/localStorage
- Resume from last successful part
- Retry failed parts automatically

### 4. Progress Tracking
- Use XMLHttpRequest or Fetch API with progress events
- Calculate upload speed and ETA
- Update UI efficiently (throttle updates)

## Error Handling & Resilience

### 1. Network Errors
- Automatic retry with exponential backoff
- Max retries: 3-5 attempts per part
- Fallback to smaller chunk sizes if needed

### 2. Upload Failures
- Detect and retry failed parts
- Abort multipart upload if too many failures
- Clean up orphaned multipart uploads

### 3. Worker Errors
- Graceful degradation
- User-friendly error messages
- Logging for debugging

### 4. Recovery Strategies
- Resume incomplete uploads
- Partial upload cleanup
- State persistence across page refreshes

## Monitoring & Observability

### 1. Metrics to Track
- Upload success rate
- Average upload time
- Upload speed
- Error rates by type
- Multipart upload completion rate

### 2. Logging
- Upload initiation events
- Part upload success/failure
- Multipart completion
- Error details with context

### 3. Alerts
- High error rates
- Slow upload speeds
- Failed multipart uploads
- Storage quota warnings

## Implementation Roadmap

### Phase 1: Backend Worker Setup (Week 1)
- [ ] Create separate backend worker project
- [ ] Configure R2 binding in wrangler.toml
- [ ] Implement authentication middleware
- [ ] Implement R2 binding upload handlers
- [ ] Implement multipart upload initiation using R2 bindings
- [ ] Implement part upload handler using R2 bindings
- [ ] Implement multipart completion using R2 bindings
- [ ] Add error handling and logging
- [ ] Write unit tests

### Phase 2: Frontend Worker Update (Week 2)
- [ ] Create separate frontend worker project
- [ ] Implement file selection UI
- [ ] Implement chunk splitting logic
- [ ] Implement concurrent upload logic (3-5 concurrent requests)
- [ ] Implement progress tracking
- [ ] Add retry logic
- [ ] Implement resume capability

### Phase 3: Integration & Testing (Week 3)
- [ ] Integrate frontend and backend workers
- [ ] Configure R2 bucket lifecycle policies
- [ ] End-to-end testing with various file sizes
- [ ] Performance testing with Worker CPU limits
- [ ] Error scenario testing
- [ ] Load testing

### Phase 4: Production Deployment (Week 4)
- [ ] Deploy backend worker with R2 binding
- [ ] Deploy frontend worker
- [ ] Configure monitoring and alerts
- [ ] Update documentation
- [ ] Gradual rollout
- [ ] Monitor and optimize

## Code Structure

### Recommended Project Structure

```
zip-uploader/
├── frontend-worker/
│   ├── src/
│   │   ├── index.js          # Frontend worker entry
│   │   ├── ui/
│   │   │   ├── upload.html   # Upload page
│   │   │   └── upload.js     # Client-side logic
│   │   └── utils/
│   │       ├── upload-manager.js
│   │       ├── chunk-splitter.js
│   │       └── progress-tracker.js
│   ├── wrangler.toml
│   └── package.json
│
├── backend-worker/
│   ├── src/
│   │   ├── index.js          # Backend worker entry
│   │   ├── routes/
│   │   │   ├── upload.js     # Upload endpoints
│   │   │   └── multipart.js   # Multipart endpoints
│   │   ├── services/
│   │   │   ├── r2-service.js
│   │   │   └── auth-service.js
│   │   └── utils/
│   │       └── upload-helpers.js
│   ├── wrangler.toml
│   └── package.json
│
└── shared/
    └── types.js              # Shared TypeScript types (if using TS)
```

## Migration Strategy

### From Current Monolithic Worker

1. **Extract Backend Logic**
   - Move R2 upload logic to backend worker
   - Move authentication to backend worker
   - Keep existing endpoints for backward compatibility

2. **Create Frontend Worker**
   - Extract UI code to frontend worker
   - Update API calls to point to backend worker
   - Implement new upload flow

3. **Gradual Migration**
   - Deploy both workers
   - Route traffic gradually
   - Monitor for issues
   - Deprecate old endpoints

## Best Practices Summary

### ✅ DO's
- Use R2 bindings for secure Worker-based uploads
- Implement multipart uploads for files >100 MB
- Use concurrent uploads (3-5 parts at a time)
- Implement retry logic with exponential backoff
- Validate files on both client and server
- Stream data through Workers to minimize memory usage
- Monitor upload metrics and errors
- Implement resume capability for better UX
- Use appropriate chunk sizes (8-16 MB)
- Configure R2 bindings in wrangler.toml

### ❌ DON'Ts
- Don't load entire files into Worker memory
- Don't upload entire files sequentially
- Don't skip client-side validation
- Don't ignore error handling
- Don't use very large chunks (>32 MB)
- Don't upload too many parts concurrently (>5-10)
- Don't skip authentication on upload endpoints
- Don't expose R2 credentials in frontend code

## References & Resources

### Cloudflare Documentation
- [R2 Multipart Upload Guide](https://developers.cloudflare.com/r2/objects/multipart-objects/)
- [R2 Bindings](https://developers.cloudflare.com/r2/buckets/bindings/)
- [R2 Platform Limits](https://developers.cloudflare.com/r2/platform/limits/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers R2 Bindings](https://developers.cloudflare.com/workers/runtime-apis/r2/)

### AWS S3 Documentation (R2 Compatible)
- [Multipart Upload API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html)
- [Upload Part API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html)
- [Complete Multipart Upload API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)

### Tools & Libraries
- [Cloudflare Workers R2 API](https://developers.cloudflare.com/workers/runtime-apis/r2/#multipart-upload-methods)
- [Uppy](https://uppy.io/) - File upload library (can be adapted for Worker-based uploads)
- [tus-js-client](https://github.com/tus/tus-js-client) - Resumable upload protocol

## Conclusion

This architecture provides a scalable, secure, and efficient solution for uploading large ZIP files to Cloudflare R2 through Cloudflare Workers. The two-worker pattern ensures optimal separation of concerns while maintaining full control over authentication, validation, and processing through the backend worker.

The implementation supports files up to 4.995 TiB using multipart uploads through R2 bindings, with automatic retry and resume capabilities for a robust user experience. By using R2 bindings instead of presigned URLs, you maintain complete control over uploads while leveraging Cloudflare's infrastructure for optimal performance. By following the best practices outlined in this document, you can build a production-ready file upload system that scales with your needs.

