/**
 * Frontend Worker for Large File Uploads
 * Provides modern UI and handles multipart upload orchestration
 */

import { APP_CSS } from './assets/app.css.js';
import { APP_JS } from './assets/app.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
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

// Upload Manager is injected into page HTML

// Serve static files
async function serveStaticFile(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (pathname === '/assets/app.css') {
    return new Response(APP_CSS, {
      status: 200,
      headers: { 'Content-Type': 'text/css; charset=utf-8', ...corsHeaders },
    });
  }
  if (pathname === '/assets/app.js') {
    return new Response(APP_JS, {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', ...corsHeaders },
    });
  }
  
  if (pathname === '/' || pathname === '/upload' || pathname === '/files') {
    return new Response(getAppPage(env), {
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders,
      },
    });
  }
  
  return new Response('Not Found', { status: 404 });
}

// Unified single-page app containing both Upload and Files views
function getAppPage(env) {
  const BACKEND_URL = env.BACKEND_WORKER_URL || '';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zip Uploader</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
    <div class="app">
      <div class="glass topbar">
        <div class="brand">
          <div class="brand-logo">🚀</div>
          <div>
            <div style="font-size:15px">Zip Uploader</div>
            <div style="font-size:12px;color:var(--muted)">Fast, spacious, and modern UI</div>
          </div>
        </div>
        <div class="top-actions">
          <button id="themeToggle" class="btn" aria-label="Toggle theme">🌓</button>
          <a id="navUpload" href="/upload" class="btn btn-primary tab">Upload</a>
          <a id="navFiles" href="/files" class="btn tab">Files</a>
        </div>
      </div>

      

      <div class="glass content">
        <section id="uploadSection">
          <div class="upload-card" id="uploadArea">
            <div class="upload-icon">📁</div>
            <div class="upload-text">Drag & drop ZIP files here or click to choose</div>
            <input type="file" id="fileInput" class="file-input" accept=".zip" multiple>
          </div>

          <div class="file-info" id="fileInfo">
            <h3>Selected File</h3>
            <div class="file-details">
              <div>
                <div class="file-detail-label">Name</div>
                <div class="file-detail-value" id="fileName">-</div>
              </div>
              <div>
                <div class="file-detail-label">Size</div>
                <div class="file-detail-value" id="fileSize">-</div>
              </div>
              <div>
                <div class="file-detail-label">Type</div>
                <div class="file-detail-value" id="fileType">-</div>
              </div>
            </div>
          </div>

          <div class="progress" id="progressContainer">
            <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
            <div class="progress-text" id="progressText">0%</div>
          </div>

          <div id="message"></div>
          <div id="uploadsList" class="uploads-list"></div>
        </section>

        <section id="filesSection" style="display:none;">
          <div class="files-container">
            <div class="files-header">
              <h3 style="font-size:16px">Files</h3>
              <button class="btn" id="refreshBtn">Refresh</button>
            </div>
            <div id="breadcrumb" class="breadcrumb"></div>
            <div class="toolbar">
              <input id="searchInput" class="input" placeholder="Filter by name..." />
              <select id="sortSelect" class="select">
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="size_desc">Size ↓</option>
                <option value="size_asc">Size ↑</option>
              </select>
            </div>
            <div id="stats" class="stats"></div>
            <div class="list-header">
              <div>Name</div>
              <div>Size</div>
              <div>Modified</div>
              <div>Actions</div>
            </div>
            <div id="filesList" class="files-list">
              <div class="loading">Loading files...</div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <script>window.__CONFIG__ = { BACKEND_URL: ${JSON.stringify(BACKEND_URL)} };</script>
    <script defer src="/assets/app.js"></script>
</body>
</html>
  `;
}

// Main worker handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;
    
    const url = new URL(request.url);
    
    // Serve static files
    return serveStaticFile(request, env);
  },
};

