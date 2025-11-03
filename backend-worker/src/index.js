/**
 * Backend Worker for Large File Uploads
 * Handles multipart uploads to R2 using bindings
 */

import { withAuth, getCorrelationId, corsHeaders } from './auth.js';
import { logError, logInfo } from './logging.js';

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

// Publisher management functions
function normalizePublisherName(name) {
  if (!name || typeof name !== 'string') return 'unknown';
  
  // Remove accents and special characters
  let normalized = name
    .normalize('NFD') // Decompose characters (É -> E + ́)
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9-_]/g, '') // Remove any remaining special characters
    .toLowerCase();
  
  if (!normalized || normalized.length === 0) return 'unknown';
  return normalized;
}

function generatePublisherGUID() {
  // Generate a 10-digit numeric GUID
  const min = 1000000000; // 10 digits minimum
  const max = 9999999999; // 10 digits maximum
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getOrCreatePublisher(displayName, env) {
  const normalizedName = normalizePublisherName(displayName);
  const publisherKey = `publishers/${normalizedName}.json`;
  
  try {
    // Try to get existing publisher
    const existing = await env.R2_BUCKET_NAME.get(publisherKey);
    if (existing) {
      const publisher = await existing.json();
      return publisher;
    }
  } catch (error) {
    // Publisher doesn't exist, create new one
  }
  
  // Create new publisher
  const publisher = {
    normalizedName: normalizedName,
    displayName: displayName,
    guid: generatePublisherGUID().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Store publisher metadata
  await env.R2_BUCKET_NAME.put(publisherKey, JSON.stringify(publisher, null, 2), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      type: 'publisher',
      normalizedName: normalizedName,
      guid: publisher.guid
    }
  });
  
  return publisher;
}

async function getPublisher(normalizedName, env) {
  const publisherKey = `publishers/${normalizedName}.json`;
  try {
    const existing = await env.R2_BUCKET_NAME.get(publisherKey);
    if (existing) {
      return await existing.json();
    }
  } catch (error) {
    // Publisher doesn't exist
  }
  return null;
}

async function listPublishers(env) {
  const publishers = [];
  try {
    const listResult = await env.R2_BUCKET_NAME.list({
      prefix: 'publishers/',
      delimiter: '/'
    });
    
    if (listResult.objects && listResult.objects.length > 0) {
      for (const obj of listResult.objects) {
        if (obj.key.endsWith('.json')) {
          try {
            const publisherObj = await env.R2_BUCKET_NAME.get(obj.key);
            if (publisherObj) {
              const publisher = await publisherObj.json();
              publishers.push(publisher);
            }
          } catch (error) {
            // Skip invalid publisher files
          }
        }
      }
    }
  } catch (error) {
    // Return empty array on error
  }
  return publishers;
}

// Generate unique filename
function generateUniqueFilename(originalFilename) {
  const ext = originalFilename.split('.').pop() || 'zip';
  const base = originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${base}.${ext}`;
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

// Simple upload handler for files < 100MB (protected endpoint)
async function handleSimpleUpload(request, env) {
  const correlationId = getCorrelationId(request);
  const formData = await request.formData();
  const file = formData.get('file');
  const providedSha256 = formData.get('sha256');
  
  if (!file) {
    throw new Error('No file provided');
  }
  
  validateFile(file, env);
  
  const filename = generateUniqueFilename(file.name);
  const key = `uploads/${filename}`;
  
  // Upload directly to R2 using binding
  // Build metadata (include sha256 if provided)
  const customMetadata = {
    originalName: file.name,
    uploadedAt: new Date().toISOString(),
    uploadType: 'simple'
  };
  if (providedSha256 && typeof providedSha256 === 'string') {
    customMetadata.sha256 = providedSha256;
  }

  await env.R2_BUCKET_NAME.put(key, file.stream(), {
    httpMetadata: { 
      contentType: file.type || 'application/zip',
      cacheControl: 'public, max-age=3600'
    },
    customMetadata
  });
  
  return {
    success: true,
    key,
    filename,
    size: file.size,
    location: `https://${env.R2_BUCKET_NAME.name}.r2.cloudflarestorage.com/${key}`,
    correlationId: correlationId
  };
}

// Multipart upload handlers
async function initiateMultipartUpload(request, env) {
  const { filename, size, contentType, sha256 } = await request.json();
  
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
    customMetadata: (function(){
      const meta = {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        uploadType: 'multipart'
      };
      if (sha256 && typeof sha256 === 'string') meta.sha256 = sha256;
      return meta;
    })()
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

// Recursive search endpoint
async function searchFiles(request, env) {
  const url = new URL(request.url);
  const rawPrefix = url.searchParams.get('prefix') || 'feeds/';
  const q = (url.searchParams.get('q') || '').trim();
  const rawLimit = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor') || undefined;

  if (!q) {
    return {
      prefix: 'feeds/',
      q: '',
      files: [],
      truncated: false,
      cursor: null
    };
  }

  // Normalize and secure prefix - must live under feeds/
  let prefix = decodeURIComponent(rawPrefix);
  if (!prefix.startsWith('feeds/')) {
    throw new Error('Invalid prefix');
  }
  if (!prefix.endsWith('/')) {
    prefix = prefix + '/';
  }

  // Limit bounds [1, 500]
  let limit = 50;
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isNaN(parsed)) {
      limit = Math.max(1, Math.min(500, parsed));
    }
  }

  // Perform recursive listing (omit delimiter) and filter by query
  const queryLower = q.toLowerCase();
  let matches = [];
  let nextCursor = cursor;
  let lastCursor = null;
  let anyTruncated = false;

  // Safeguard: do at most 10 pages per request to bound latency
  let pagesScanned = 0;
  const MAX_PAGES = 10;

  while (matches.length < limit && pagesScanned < MAX_PAGES) {
    const listResult = await env.R2_BUCKET_NAME.list({
      prefix,
      // no delimiter => recursive
      limit: 1000,
      cursor: nextCursor,
    });
    pagesScanned++;
    anyTruncated = !!listResult.truncated;
    lastCursor = listResult.cursor || null;

    const pageMatches = (listResult.objects || []).filter(obj =>
      obj.key && obj.key.toLowerCase().includes(queryLower)
    ).map(obj => ({
      key: obj.key,
      filename: obj.key.split('/').pop(),
      size: obj.size,
      lastModified: obj.uploaded,
      etag: obj.etag,
    }));

    for (const m of pageMatches) {
      matches.push(m);
      if (matches.length >= limit) break;
    }

    if (!listResult.truncated || matches.length >= limit) {
      break;
    }
    nextCursor = listResult.cursor;
  }

  return {
    prefix,
    q,
    files: matches.slice(0, limit),
    truncated: anyTruncated,
    cursor: anyTruncated ? (lastCursor || null) : null,
  };
}

// List files endpoint
async function listFiles(request, env) {
  const url = new URL(request.url);
  const rawPrefix = url.searchParams.get('prefix') || 'feeds/';
  const rawLimit = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor') || undefined;

  // Normalize and secure prefix - must live under feeds/
  let prefix = decodeURIComponent(rawPrefix);
  if (!prefix.startsWith('feeds/')) {
    throw new Error('Invalid prefix');
  }
  if (!prefix.endsWith('/')) {
    prefix = prefix + '/';
  }

  // Limit bounds [1, 1000]
  let limit = 1000;
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isNaN(parsed)) {
      limit = Math.max(1, Math.min(1000, parsed));
    }
  }

  const listResult = await env.R2_BUCKET_NAME.list({
    prefix,
    delimiter: '/',
    limit,
    cursor
  });

  const folders = Array.isArray(listResult.delimitedPrefixes) ? listResult.delimitedPrefixes : [];
  const files = (listResult.objects || []).map(obj => ({
    key: obj.key,
    filename: obj.key.split('/').pop(),
    size: obj.size,
    lastModified: obj.uploaded,
    etag: obj.etag
  }));

  return {
    prefix,
    folders,
    files,
    truncated: !!listResult.truncated,
    cursor: listResult.truncated ? (listResult.cursor || null) : null
  };
}

// Delete file endpoint (requires admin key)
async function deleteFile(request, env) {
  const correlationId = getCorrelationId(request);
  const url = new URL(request.url);
  const key = url.pathname.split('/api/files/')[1];
  
  if (!key) {
    throw new Error('File key is required');
  }
  
  await env.R2_BUCKET_NAME.delete(key);
  
  return {
    success: true,
    message: 'File deleted successfully',
    correlationId: correlationId
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
  const correlationId = getCorrelationId(request);
  
  try {
    // Health check (no auth required)
    if (pathname === '/api/health') {
      const health = await healthCheck(env);
      return new Response(JSON.stringify(health), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: health.status === 'healthy' ? 200 : 503
      });
    }
    
    // Route handlers (all protected except /api/health)
    switch (pathname) {
      case '/api/upload':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const simpleResult = await handleSimpleUpload(request, env);
        return new Response(JSON.stringify(simpleResult), {
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
        });
        
      case '/api/upload/multipart/init':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const initResult = await initiateMultipartUpload(request, env);
        return new Response(JSON.stringify({ ...initResult, correlationId }), {
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
        });
        
      case '/api/upload/multipart/part':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const partResult = await uploadPart(request, env);
        return new Response(JSON.stringify({ ...partResult, correlationId }), {
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
        });
        
      case '/api/upload/multipart/complete':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const completeResult = await completeMultipartUpload(request, env);
        return new Response(JSON.stringify({ ...completeResult, correlationId }), {
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
        });
        
      case '/api/upload/multipart/abort':
        if (request.method !== 'POST') {
          throw new Error('Method not allowed');
        }
        const abortResult = await abortMultipartUpload(request, env);
        return new Response(JSON.stringify({ ...abortResult, correlationId }), {
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
        });
        
      case '/api/search':
        if (request.method === 'GET') {
          const searchResult = await searchFiles(request, env);
          return new Response(JSON.stringify({ ...searchResult, correlationId }), {
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
          });
        }
        throw new Error('Method not allowed');

      case '/api/files':
        if (request.method === 'GET') {
          const filesResult = await listFiles(request, env);
          return new Response(JSON.stringify({ ...filesResult, correlationId }), {
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
          });
        }
        throw new Error('Method not allowed');
        
      case '/api/publishers':
        if (request.method === 'GET') {
          const publishers = await listPublishers(env);
          return new Response(JSON.stringify({ publishers, correlationId }), {
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
          });
        }
        if (request.method === 'POST') {
          const { displayName } = await request.json();
          if (!displayName || typeof displayName !== 'string') {
            throw new Error('displayName is required');
          }
          const publisher = await getOrCreatePublisher(displayName, env);
          return new Response(JSON.stringify({ publisher, correlationId }), {
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
          });
        }
        throw new Error('Method not allowed');
        
      default:
        if (pathname.startsWith('/api/publishers/') && request.method === 'GET') {
          const normalizedName = decodeURIComponent(pathname.replace('/api/publishers/', ''));
          if (!normalizedName) {
            throw new Error('Publisher name is required');
          }
          const publisher = await getPublisher(normalizedName, env);
          if (!publisher) {
            return new Response(JSON.stringify({ error: 'Publisher not found', correlationId }), {
              status: 404,
              headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
            });
          }
          return new Response(JSON.stringify({ publisher, correlationId }), {
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
          });
        }
        if (pathname.startsWith('/api/files-inline/') && request.method === 'GET') {
          const key = decodeURIComponent(pathname.replace('/api/files-inline/', ''));
          if (!key) {
            throw new Error('File key is required');
          }
          const obj = await env.R2_BUCKET_NAME.get(key);
          if (!obj) {
            return new Response(JSON.stringify({ error: 'File not found', correlationId }), {
              status: 404,
              headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
            });
          }
          const filename = key.split('/').pop() || 'file';
          const headers = {
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${filename}"`,
            'X-Correlation-ID': correlationId,
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600',
          };
          if (obj.etag) headers['ETag'] = obj.etag;
          if (obj.customMetadata && obj.customMetadata.sha256) headers['X-Checksum-SHA256'] = obj.customMetadata.sha256;
          return new Response(obj.body, { headers });
        }
        if (pathname.startsWith('/api/files/') && request.method === 'DELETE') {
          const deleteResult = await deleteFile(request, env);
          return new Response(JSON.stringify(deleteResult), {
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
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
            return new Response(JSON.stringify({ error: 'File not found', correlationId }), {
              status: 404,
              headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...corsHeaders }
            });
          }
          const filename = key.split('/').pop() || 'file';
          const headers = {
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Correlation-ID': correlationId,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Expose-Headers': 'ETag, X-Checksum-SHA256, X-Correlation-ID',
            'Cache-Control': 'public, max-age=3600',
          };
          if (obj.etag) headers['ETag'] = obj.etag;
          if (obj.customMetadata && obj.customMetadata.sha256) headers['X-Checksum-SHA256'] = obj.customMetadata.sha256;
          return new Response(obj.body, { headers });
        }
        throw new Error('Endpoint not found');
    }
    
  } catch (error) {
    const correlationIdForError = getCorrelationId(request);
    logError('API request failed', error, {
      correlationId: correlationIdForError,
      pathname: pathname,
      method: request.method
    });
    
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      correlationId: correlationIdForError,
      timestamp: new Date().toISOString()
    }), {
      status: error.message.includes('not found') ? 404 : 
              error.message.includes('not allowed') ? 405 :
              error.message.includes('required') ? 400 : 500,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationIdForError, ...corsHeaders }
    });
  }
}

// Wrapper for handleAPI that adds authentication
// Health endpoint is handled separately (no auth)
async function handleAPIAuth(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const correlationId = getCorrelationId(request);
  
  // Health check endpoint - no auth required
  if (pathname === '/api/health') {
    // Log health check with correlation ID
    console.log(JSON.stringify({
      level: 'info',
      message: 'Health check',
      correlationId: correlationId,
      pathname: pathname,
      timestamp: new Date().toISOString()
    }));
    return handleAPI(request, env);
  }
  
  // DELETE operations require admin key
  const requireAdmin = pathname.startsWith('/api/files/') && request.method === 'DELETE';
  
  // Wrap with authentication middleware
  return withAuth(handleAPI, requireAdmin)(request, env, ctx);
}

// Main worker handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight (no auth required)
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;
    
    const url = new URL(request.url);
    
    // API routes (protected with authentication)
    if (url.pathname.startsWith('/api/')) {
      return handleAPIAuth(request, env, ctx);
    }
    
    // Default response
    return new Response(JSON.stringify({
      service: 'zip-uploader-worker',
      message: 'Backend worker for large file uploads',
      endpoints: [
        'GET /api/health (no auth required)',
        'POST /api/upload (auth required)',
        'POST /api/upload/multipart/init (auth required)',
        'POST /api/upload/multipart/part (auth required)',
        'POST /api/upload/multipart/complete (auth required)',
        'POST /api/upload/multipart/abort (auth required)',
        'GET /api/search (auth required)',
        'GET /api/files (auth required)',
        'DELETE /api/files/{key} (admin auth required)',
        'GET /api/publishers (auth required)',
        'POST /api/publishers (auth required)',
        'GET /api/publishers/{normalizedName} (auth required)'
      ]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  },
};

