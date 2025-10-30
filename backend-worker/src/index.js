/**
 * Backend Worker for Large File Uploads
 * Handles multipart uploads to R2 using bindings
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight requests
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
}

// No authentication required

// Generate unique filename
function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const ext = originalFilename.split('.').pop() || 'zip';
  const base = originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${timestamp}-${base}.${ext}`;
}

// Validate file type and size
function validateFile(file, env) {
  const maxSize = parseInt(env.MAX_FILE_SIZE) || 5368709120; // 5GB default
  
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`);
  }
  
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('Only ZIP files are allowed');
  }
  
  return true;
}

// Simple upload handler for files < 100MB
async function handleSimpleUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  
  if (!file) {
    throw new Error('No file provided');
  }
  
  validateFile(file, env);
  
  const filename = generateUniqueFilename(file.name);
  const key = `uploads/${filename}`;
  
  // Upload directly to R2 using binding
  await env.R2_BUCKET_NAME.put(key, file.stream(), {
    httpMetadata: { 
      contentType: file.type || 'application/zip',
      cacheControl: 'public, max-age=3600'
    },
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadType: 'simple'
    }
  });
  
  return {
    success: true,
    key,
    filename,
    size: file.size,
    location: `https://${env.R2_BUCKET_NAME.name}.r2.cloudflarestorage.com/${key}`
  };
}

// Multipart upload handlers
async function initiateMultipartUpload(request, env) {
  const { filename, size, contentType } = await request.json();
  
  if (!filename || !size) {
    throw new Error('Filename and size are required');
  }
  
  const maxSize = parseInt(env.MAX_FILE_SIZE) || 5368709120;
  if (size > maxSize) {
    throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`);
  }
  
  const uniqueFilename = generateUniqueFilename(filename);
  const key = `uploads/${uniqueFilename}`;
  
  // Initiate multipart upload using R2 binding
  const multipart = await env.R2_BUCKET_NAME.createMultipartUpload(key, {
    httpMetadata: { 
      contentType: contentType || 'application/zip',
      cacheControl: 'public, max-age=3600'
    },
    customMetadata: {
      originalName: filename,
      uploadedAt: new Date().toISOString(),
      uploadType: 'multipart'
    }
  });
  
  return {
    uploadId: multipart.uploadId,
    key,
    filename: uniqueFilename
  };
}

async function uploadPart(request, env) {
  const formData = await request.formData();
  const chunk = formData.get('chunk');
  const key = formData.get('key');
  const uploadId = formData.get('uploadId');
  const partNumber = parseInt(formData.get('partNumber'));
  
  if (!chunk || !key || !uploadId || !partNumber) {
    throw new Error('Missing required fields: chunk, key, uploadId, partNumber');
  }
  
  // Upload part using R2 multipart session
  const multipart = await env.R2_BUCKET_NAME.resumeMultipartUpload(key, uploadId);
  const body = typeof chunk?.stream === 'function' ? chunk.stream() : chunk;
  const uploadedPart = await multipart.uploadPart(partNumber, body);
  
  return {
    partNumber,
    etag: uploadedPart.etag,
    success: true
  };
}

async function completeMultipartUpload(request, env) {
  const { key, uploadId, parts } = await request.json();
  
  if (!key || !uploadId || !parts || !Array.isArray(parts)) {
    throw new Error('Missing required fields: key, uploadId, parts');
  }
  
  // Validate parts array
  const validatedParts = parts.map(part => ({
    PartNumber: parseInt(part.PartNumber),
    ETag: part.ETag
  }));
  
  // Complete multipart upload using R2 multipart session
  const multipart = await env.R2_BUCKET_NAME.resumeMultipartUpload(key, uploadId);
  const partsForComplete = validatedParts.map(p => ({ partNumber: p.PartNumber, etag: p.ETag }));
  await multipart.complete(partsForComplete);
  
  return {
    success: true,
    key,
    location: `https://${env.R2_BUCKET_NAME.name}.r2.cloudflarestorage.com/${key}`
  };
}

async function abortMultipartUpload(request, env) {
  const { key, uploadId } = await request.json();
  
  if (!key || !uploadId) {
    throw new Error('Missing required fields: key, uploadId');
  }
  
  // Abort multipart upload using R2 multipart session
  const multipart = await env.R2_BUCKET_NAME.resumeMultipartUpload(key, uploadId);
  await multipart.abort();
  
  return {
    success: true,
    message: 'Multipart upload aborted'
  };
}

// List files endpoint
async function listFiles(request, env) {
  const prefix = 'unzipped/';
  const limit = 1000; // R2 limit
  
  const objects = await env.R2_BUCKET_NAME.list({
    prefix,
    limit
  });
  
  const files = objects.objects.map(obj => ({
    key: obj.key,
    filename: obj.key.split('/').pop(),
    size: obj.size,
    lastModified: obj.uploaded,
    etag: obj.etag
  }));
  
  return {
    files,
    count: files.length,
    prefix
  };
}

// Delete file endpoint
async function deleteFile(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.split('/api/files/')[1];
  
  if (!key) {
    throw new Error('File key is required');
  }
  
  await env.R2_BUCKET_NAME.delete(key);
  
  return {
    success: true,
    message: 'File deleted successfully'
  };
}

// Health check endpoint
async function healthCheck(env) {
  try {
    // Test R2 connection
    await env.R2_BUCKET_NAME.list({ limit: 1 });
    
    return {
      status: 'healthy',
      service: 'zip-uploader-worker',
      r2_connected: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      service: 'zip-uploader-worker',
      r2_connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Main API handler
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Health check (no auth required)
    if (pathname === '/api/health') {
      const health = await healthCheck(env);
      return new Response(JSON.stringify(health), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: health.status === 'healthy' ? 200 : 503
      });
    }
    
    // Route handlers
    switch (pathname) {
      case '/api/upload':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const simpleResult = await handleSimpleUpload(request, env);
        return new Response(JSON.stringify(simpleResult), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      case '/api/upload/multipart/init':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const initResult = await initiateMultipartUpload(request, env);
        return new Response(JSON.stringify(initResult), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      case '/api/upload/multipart/part':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const partResult = await uploadPart(request, env);
        return new Response(JSON.stringify(partResult), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      case '/api/upload/multipart/complete':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const completeResult = await completeMultipartUpload(request, env);
        return new Response(JSON.stringify(completeResult), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      case '/api/upload/multipart/abort':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const abortResult = await abortMultipartUpload(request, env);
        return new Response(JSON.stringify(abortResult), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      case '/api/files':
        if (request.method === 'GET') {
          const filesResult = await listFiles(request, env);
          return new Response(JSON.stringify(filesResult), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        throw new Error('Method not allowed');
        
      default:
        if (pathname.startsWith('/api/files/') && request.method === 'DELETE') {
          const deleteResult = await deleteFile(request, env);
          return new Response(JSON.stringify(deleteResult), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (pathname.startsWith('/api/files/') && request.method === 'GET') {
          // Download/get file
          const key = decodeURIComponent(pathname.replace('/api/files/', ''));
          if (!key) {
            throw new Error('File key is required');
          }
          const obj = await env.R2_BUCKET_NAME.get(key);
          if (!obj) {
            return new Response(JSON.stringify({ error: 'File not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          const filename = key.split('/').pop() || 'file';
          const headers = {
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'public, max-age=3600',
          };
          if (obj.etag) headers['ETag'] = obj.etag;
          return new Response(obj.body, { headers });
        }
        throw new Error('Endpoint not found');
    }
    
  } catch (error) {
    console.error('API Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: error.message.includes('not found') ? 404 : 
              error.message.includes('not allowed') ? 405 :
              error.message.includes('required') ? 400 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Main worker handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;
    
    const url = new URL(request.url);
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }
    
    // Default response
    return new Response(JSON.stringify({
      service: 'zip-uploader-worker',
      message: 'Backend worker for large file uploads',
      endpoints: [
        'GET /api/health',
        'POST /api/upload',
        'POST /api/upload/multipart/init',
        'POST /api/upload/multipart/part',
        'POST /api/upload/multipart/complete',
        'POST /api/upload/multipart/abort',
        'GET /api/files',
        'DELETE /api/files/{key}'
      ]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  },
};

