/// <reference types="@cloudflare/workers-types" />

/**
 * Backend Worker for Large File Uploads
 * Handles file uploads, file management, and R2 operations
 */

import type { Env } from './types.js';
import { corsHeaders, withAuth, getCorrelationId } from './auth.js';

// Health check endpoint (no auth required)
async function healthCheck(request: Request, env: Env): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'zip-uploader-worker',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// Handle CORS preflight
function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  return null;
}

// Simple upload handler
async function handleSimpleUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const path = formData.get('path') as string | null;
    
    if (!fileEntry || typeof fileEntry === 'string') {
      return new Response(JSON.stringify({
        error: 'No file provided',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const file = fileEntry as File;
    const key = path ? `${path}/${file.name}` : file.name;
    await env.R2_BUCKET_NAME.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream'
      }
    });
    
    return new Response(JSON.stringify({
      success: true,
      key,
      size: file.size,
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Upload failed',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Multipart upload init
async function initiateMultipartUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const body = await request.json() as { filename: string; size: number; path?: string };
    const uploadId = crypto.randomUUID();
    const key = body.path ? `${body.path}/${body.filename}` : body.filename;
    
    // Store upload metadata (simplified - in production you'd use KV or Durable Objects)
    return new Response(JSON.stringify({
      uploadId,
      key,
      chunkSize: parseInt(env.CHUNK_SIZE || '8388608'),
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to initiate upload',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Upload part
async function uploadPart(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const formData = await request.formData();
    const chunkEntry = formData.get('chunk');
    const uploadId = formData.get('uploadId') as string | null;
    const partNumber = formData.get('partNumber') as string | null;
    
    if (!chunkEntry || typeof chunkEntry === 'string' || !uploadId || !partNumber) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const partNumberInt = parseInt(partNumber);
    if (isNaN(partNumberInt)) {
      return new Response(JSON.stringify({
        error: 'Invalid part number',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Store part (simplified - in production you'd use R2 multipart API)
    const chunk = chunkEntry as File;
    const partKey = `parts/${uploadId}/${partNumberInt}`;
    await env.R2_BUCKET_NAME.put(partKey, chunk.stream());
    
    return new Response(JSON.stringify({
      success: true,
      partNumber: partNumberInt,
      etag: `"${crypto.randomUUID()}"`,
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to upload part',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Complete multipart upload
async function completeMultipartUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const body = await request.json() as { uploadId: string; key: string; parts: Array<{ partNumber: number; etag: string }> };
    
    // Combine parts (simplified - in production you'd use R2 multipart API)
    // For now, return success
    return new Response(JSON.stringify({
      success: true,
      key: body.key,
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to complete upload',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Abort multipart upload
async function abortMultipartUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const body = await request.json() as { uploadId: string };
    
    // Clean up parts (simplified)
    return new Response(JSON.stringify({
      success: true,
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to abort upload',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// List files
async function listFiles(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    const cursor = url.searchParams.get('cursor') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    const result = await env.R2_BUCKET_NAME.list({
      prefix,
      cursor,
      limit,
      delimiter: '/'
    });
    
    // Separate files and folders
    const folders: string[] = [];
    const files: Array<{ key: string; filename: string; size: number; lastModified: string; uploaded?: string; etag?: string }> = [];
    
    // Process delimited prefixes (folders)
    if (result.delimitedPrefixes) {
      result.delimitedPrefixes.forEach((prefixName: string) => {
        folders.push(prefixName);
      });
    }
    
    // Process objects (files)
    result.objects.forEach((obj: R2Object) => {
      // Skip if it's a "folder" marker (ends with /)
      if (obj.key.endsWith('/')) {
        return;
      }
      files.push({
        key: obj.key,
        filename: obj.key,
        size: obj.size,
        lastModified: obj.uploaded?.toISOString() || new Date().toISOString(),
        uploaded: obj.uploaded?.toISOString(),
        etag: obj.etag
      });
    });
    
    return new Response(JSON.stringify({
      folders,
      files,
      cursor: 'cursor' in result ? result.cursor : undefined,
      truncated: result.truncated,
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to list files',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Search files
async function searchFiles(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const prefix = url.searchParams.get('prefix') || 'feeds/';
    
    if (!query) {
      return new Response(JSON.stringify({
        error: 'Query parameter q is required',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const result = await env.R2_BUCKET_NAME.list({ prefix });
    const matches = result.objects.filter((obj: R2Object) => 
      obj.key.toLowerCase().includes(query.toLowerCase()) && !obj.key.endsWith('/')
    );
    
    return new Response(JSON.stringify({
      files: matches.map((obj: R2Object) => ({
        key: obj.key,
        filename: obj.key,
        size: obj.size,
        lastModified: obj.uploaded?.toISOString() || new Date().toISOString(),
        uploaded: obj.uploaded?.toISOString()
      })),
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to search files',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Get file (download)
async function getFile(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const url = new URL(request.url);
    const keyMatch = url.pathname.match(/^\/api\/files\/(.+)$/);
    if (!keyMatch) {
      return new Response(JSON.stringify({
        error: 'Invalid file key',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const key = decodeURIComponent(keyMatch[1]);
    const object = await env.R2_BUCKET_NAME.get(key);
    
    if (!object) {
      return new Response(JSON.stringify({
        error: 'File not found',
        correlationId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
        'Content-Length': object.size.toString(),
        'ETag': object.etag || '',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get file',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Get file inline
async function getFileInline(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const url = new URL(request.url);
    const keyMatch = url.pathname.match(/^\/api\/files-inline\/(.+)$/);
    if (!keyMatch) {
      return new Response(JSON.stringify({
        error: 'Invalid file key',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const key = decodeURIComponent(keyMatch[1]);
    const object = await env.R2_BUCKET_NAME.get(key);
    
    if (!object) {
      return new Response(JSON.stringify({
        error: 'File not found',
        correlationId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get file',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Delete file
async function deleteFile(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    const url = new URL(request.url);
    const keyMatch = url.pathname.match(/^\/api\/files\/(.+)$/);
    if (!keyMatch) {
      return new Response(JSON.stringify({
        error: 'Invalid file key',
        correlationId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const key = decodeURIComponent(keyMatch[1]);
    await env.R2_BUCKET_NAME.delete(key);
    
    return new Response(JSON.stringify({
      success: true,
      key,
      correlationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to delete file',
      correlationId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Root endpoint
async function handleRoot(request: Request, env: Env): Promise<Response> {
  return new Response(JSON.stringify({
    service: 'zip-uploader-worker',
    version: '1.0.0',
    endpoints: [
      'GET /api/health',
      'POST /api/upload',
      'POST /api/upload/multipart/init',
      'POST /api/upload/multipart/part',
      'POST /api/upload/multipart/complete',
      'POST /api/upload/multipart/abort',
      'GET /api/files',
      'GET /api/files/{key}',
      'GET /api/files-inline/{key}',
      'DELETE /api/files/{key}',
      'GET /api/search'
    ]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Main fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;
    
    // Health check (no auth)
    if (pathname === '/api/health') {
      return healthCheck(request, env);
    }
    
    // Root endpoint (no auth)
    if (pathname === '/' || pathname === '') {
      return handleRoot(request, env);
    }
    
    // Protected endpoints with auth
    if (pathname === '/api/upload' && request.method === 'POST') {
      return withAuth(handleSimpleUpload, false)(request, env, ctx);
    }
    
    if (pathname === '/api/upload/multipart/init' && request.method === 'POST') {
      return withAuth(initiateMultipartUpload, false)(request, env, ctx);
    }
    
    if (pathname === '/api/upload/multipart/part' && request.method === 'POST') {
      return withAuth(uploadPart, false)(request, env, ctx);
    }
    
    if (pathname === '/api/upload/multipart/complete' && request.method === 'POST') {
      return withAuth(completeMultipartUpload, false)(request, env, ctx);
    }
    
    if (pathname === '/api/upload/multipart/abort' && request.method === 'POST') {
      return withAuth(abortMultipartUpload, false)(request, env, ctx);
    }
    
    if (pathname === '/api/search' && request.method === 'GET') {
      return withAuth(searchFiles, false)(request, env, ctx);
    }
    
    if (pathname === '/api/files' && request.method === 'GET') {
      return withAuth(listFiles, false)(request, env, ctx);
    }
    
    if (pathname.startsWith('/api/files-inline/') && request.method === 'GET') {
      return withAuth(getFileInline, false)(request, env, ctx);
    }
    
    if (pathname.startsWith('/api/files/') && request.method === 'GET') {
      return withAuth(getFile, false)(request, env, ctx);
    }
    
    if (pathname.startsWith('/api/files/') && request.method === 'DELETE') {
      return withAuth(deleteFile, false)(request, env, ctx);
    }
    
    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      path: pathname
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
