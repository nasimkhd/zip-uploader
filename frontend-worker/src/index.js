/**
 * Frontend Worker for Large File Uploads
 * Provides modern UI and handles multipart upload orchestration
 */

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
    <title>Large File Uploader</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; text-align: center; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; font-weight: 700; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .content { padding: 2rem; }
        .nav { display: flex; gap: 1rem; margin-bottom: 2rem; justify-content: center; }
        .nav-button { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-decoration: none; display: inline-block; }
        .nav-button.active { background: #667eea; color: white; }
        .nav-button:not(.active) { background: #f8f9fa; color: #666; }
        .nav-button:not(.active):hover { background: #e9ecef; transform: translateY(-2px); }
        /* Upload */
        .upload-area { border: 3px dashed #667eea; border-radius: 12px; padding: 3rem; text-align: center; background: #f8f9ff; transition: all 0.3s ease; cursor: pointer; }
        .upload-area:hover { border-color: #5a6fd8; background: #f0f2ff; }
        .upload-area.dragover { border-color: #4c63d2; background: #e8ebff; transform: scale(1.02); }
        .upload-icon { font-size: 4rem; margin-bottom: 1rem; color: #667eea; }
        .upload-text { font-size: 1.2rem; color: #666; margin-bottom: 1rem; }
        .file-input { display: none; }
        .upload-button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .upload-button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3); }
        .upload-button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .progress-container { margin-top: 2rem; display: none; }
        .progress-bar { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: 0%; transition: width 0.3s ease; }
        .progress-text { text-align: center; margin-top: 0.5rem; color: #666; font-weight: 500; }
        .message { padding: 1rem; border-radius: 8px; margin-top: 1rem; font-weight: 500; }
        .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .message.info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .file-info { background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 1rem; display: none; }
        .file-info h3 { color: #333; margin-bottom: 0.5rem; }
        .file-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 0.5rem; }
        .file-detail { text-align: center; }
        .file-detail-label { font-size: 0.9rem; color: #666; margin-bottom: 0.25rem; }
        .file-detail-value { font-weight: 600; color: #333; }
        .uploads-list { margin-top: 1rem; display: grid; gap: 12px; }
        .upload-item { padding: 12px; border: 1px solid #e9ecef; border-radius: 8px; background: #fff; }
        .upload-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .upload-item-name { font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .upload-item-status { color: #666; font-size: 0.9rem; }
        /* Files */
        .files-container { background: #f8f9fa; border-radius: 12px; padding: 1.5rem; }
        .files-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: #666; }
        .breadcrumb a { color: #667eea; text-decoration: none; font-weight: 500; }
        .breadcrumb a:hover { text-decoration: underline; }
        .breadcrumb-sep { color: #999; }
        .toolbar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #e3e6ef; border-radius: 6px; }
        .sort-select { padding: 8px 12px; border: 1px solid #e3e6ef; border-radius: 6px; background: #fff; }
        .stats { color: #777; font-size: 0.9rem; margin-bottom: 0.5rem; }
        .list-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; padding: 0.75rem 1rem; font-weight: 600; color: #444; background: #f3f4f6; position: sticky; top: 0; z-index: 1; border-bottom: 1px solid #e9ecef; }
        .refresh-button { background: #28a745; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .files-list { background: white; border-radius: 8px; overflow: hidden; }
        .file-item { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; padding: 1rem; border-bottom: 1px solid #e9ecef; align-items: center; }
        .file-item:last-child { border-bottom: none; }
        .file-item:hover { background: #f8f9ff; }
        .file-name { font-weight: 500; color: #333; }
        .file-size { color: #666; }
        .file-date { color: #666; font-size: 0.9rem; }
        .file-actions { display: flex; gap: 0.5rem; }
        .action-button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
        .download-button { background: #007bff; color: white; }
        .delete-button { background: #dc3545; color: white; }
        .loading { text-align: center; padding: 2rem; color: #666; }
        .no-files { text-align: center; padding: 2rem; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Zip File Uploader</h1>
        </div>
        <div class="content">
            <nav class="nav">
                <a id="navUpload" href="/upload" class="nav-button">Upload Files</a>
                <a id="navFiles" href="/files" class="nav-button">View Files</a>
            </nav>

            <section id="uploadSection">
                <div class="upload-area" id="uploadArea">
                    <div class="upload-icon">📁</div>
                    <div class="upload-text">Drag and drop your ZIP files here, or click to select</div>
                    <input type="file" id="fileInput" class="file-input" accept=".zip" multiple>
                </div>
                <div class="file-info" id="fileInfo">
                    <h3>Selected File</h3>
                    <div class="file-details">
                        <div class="file-detail">
                            <div class="file-detail-label">Name</div>
                            <div class="file-detail-value" id="fileName">-</div>
                        </div>
                        <div class="file-detail">
                            <div class="file-detail-label">Size</div>
                            <div class="file-detail-value" id="fileSize">-</div>
                        </div>
                        <div class="file-detail">
                            <div class="file-detail-label">Type</div>
                            <div class="file-detail-value" id="fileType">-</div>
                        </div>
                    </div>
                </div>
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">0%</div>
                </div>
                <div id="message"></div>
                <div id="uploadsList" class="uploads-list"></div>
            </section>

            <section id="filesSection" style="display:none;">
                <div class="files-container">
                    <div class="files-header">
                        <h3>Files</h3>
                        <button class="refresh-button" id="refreshBtn">Refresh</button>
                    </div>
                    <div id="breadcrumb" class="breadcrumb"></div>
                    <div class="toolbar">
                        <input id="searchInput" class="search-input" placeholder="Filter by name..." />
                        <select id="sortSelect" class="sort-select">
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

    <script>
        // Config
        const BACKEND_URL = ${JSON.stringify(BACKEND_URL)};

        // Routing
        function setActiveNav(route) {
            var u = document.getElementById('navUpload');
            var f = document.getElementById('navFiles');
            if (u && f) { u.classList.toggle('active', route === 'upload'); f.classList.toggle('active', route === 'files'); }
        }
        function showRoute(route) {
            var us = document.getElementById('uploadSection');
            var fs = document.getElementById('filesSection');
            if (!us || !fs) return;
            if (route === 'files') { us.style.display = 'none'; fs.style.display = 'block'; }
            else { us.style.display = 'block'; fs.style.display = 'none'; }
            setActiveNav(route);
        }
        function navigate(route, replace) {
            var url = new URL(location.href);
            if (route === 'files') url.pathname = '/files'; else { url.pathname = '/upload'; url.search = ''; }
            if (replace) history.replaceState({ route }, '', url); else history.pushState({ route }, '', url);
            showRoute(route);
            if (route === 'files') loadFiles(null, 0);
        }
        (function(){
            var nu = document.getElementById('navUpload');
            var nf = document.getElementById('navFiles');
            if (nu) nu.addEventListener('click', function(e){ e.preventDefault(); navigate('upload'); });
            if (nf) nf.addEventListener('click', function(e){ e.preventDefault(); navigate('files'); });
            window.addEventListener('popstate', function(){ var r = (location.pathname === '/files') ? 'files' : 'upload'; showRoute(r); if (r === 'files') { setTimeout(function(){ pageCursors = [null]; currentPageIndex = 0; loadFiles(null, 0); }, 0); } });
            var initialRoute = (location.pathname === '/files') ? 'files' : 'upload';
            setTimeout(function(){ navigate(initialRoute, true); }, 0);
        })();

        // Upload logic
        class UploadManager {
            constructor(backendUrl, chunkSize = 8 * 1024 * 1024, maxConcurrent = 5) {
                this.backendUrl = backendUrl;
                this.chunkSize = chunkSize;
                this.maxConcurrent = maxConcurrent;
                this.activeUploads = new Map();
            }
            async uploadFile(file, onProgress) {
                const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                try {
                    if (file.size < 100 * 1024 * 1024) return await this.simpleUpload(file, fileId, onProgress);
                    return await this.multipartUpload(file, fileId, onProgress);
                } catch (e) { console.error('Upload failed:', e); throw e; }
            }
            async simpleUpload(file, fileId, onProgress) {
                const fd = new FormData(); fd.append('file', file);
                const res = await fetch(this.backendUrl + '/api/upload', { method: 'POST', body: fd });
                if (!res.ok) { let m = 'Upload failed'; try { const err = await res.json(); m = err.error || m; } catch {} throw new Error(m); }
                onProgress && onProgress(100); return await res.json();
            }
            async multipartUpload(file, fileId, onProgress) {
                const init = await fetch(this.backendUrl + '/api/upload/multipart/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || 'application/zip' }) });
                if (!init.ok) { let m = 'Failed to initiate multipart upload'; try { const e = await init.json(); m = e.error || m; } catch {} throw new Error(m); }
                const { uploadId, key } = await init.json(); this.activeUploads.set(fileId, { uploadId, key, file });
                try {
                    const chunks = this.splitFileIntoChunks(file); const parts = [];
                    for (let i = 0; i < chunks.length; i += this.maxConcurrent) {
                        const batch = chunks.slice(i, i + this.maxConcurrent);
                        const results = await Promise.allSettled(batch.map((chunk, idx) => this.uploadChunk(key, uploadId, i + idx + 1, chunk)));
                        for (const r of results) { if (r.status === 'fulfilled') parts.push(r.value); else throw new Error('Chunk upload failed: ' + (r.reason && r.reason.message ? r.reason.message : 'unknown error')); }
                        const progress = Math.round(((i + batch.length) / chunks.length) * 100); onProgress && onProgress(progress);
                    }
                    const complete = await fetch(this.backendUrl + '/api/upload/multipart/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, uploadId, parts: parts.map(function(p){ return { PartNumber: p.partNumber, ETag: p.etag }; }) }) });
                    if (!complete.ok) { let m = 'Failed to complete multipart upload'; try { const e = await complete.json(); m = e.error || m; } catch {} throw new Error(m); }
                    const result = await complete.json(); this.activeUploads.delete(fileId); onProgress && onProgress(100); return result;
                } catch (err) {
                    try { await fetch(this.backendUrl + '/api/upload/multipart/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, uploadId }) }); } catch (_) {}
                    this.activeUploads.delete(fileId); throw err;
                }
            }
            splitFileIntoChunks(file) { const chunks = []; let offset = 0; while (offset < file.size) { const end = Math.min(offset + this.chunkSize, file.size); chunks.push(file.slice(offset, end)); offset = end; } return chunks; }
            async uploadChunk(key, uploadId, partNumber, chunk) { const fd = new FormData(); fd.append('chunk', chunk); fd.append('key', key); fd.append('uploadId', uploadId); fd.append('partNumber', String(partNumber)); const res = await fetch(this.backendUrl + '/api/upload/multipart/part', { method: 'POST', body: fd }); if (!res.ok) { let m = 'Failed to upload part ' + partNumber; try { const e = await res.json(); m = e.error || m; } catch {} throw new Error(m); } return await res.json(); }
        }

        const uploadManager = new UploadManager(BACKEND_URL);
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadsListEl = document.getElementById('uploadsList');

        const MAX_PARALLEL_FILE_UPLOADS = 2; // limit simultaneous file uploads
        let fileUploadQueue = [];
        let activeFileUploads = 0;

        if (fileInput) fileInput.addEventListener('change', function(e){ enqueueFiles(e.target.files); e.target.value = ''; });
        if (uploadArea) {
            uploadArea.addEventListener('dragover', function(e){ e.preventDefault(); uploadArea.classList.add('dragover'); });
            uploadArea.addEventListener('dragleave', function(e){ e.preventDefault(); uploadArea.classList.remove('dragover'); });
            uploadArea.addEventListener('drop', function(e){ e.preventDefault(); uploadArea.classList.remove('dragover'); enqueueFiles(e.dataTransfer.files); });
            uploadArea.addEventListener('click', function(){ fileInput && fileInput.click(); });
        }

        function enqueueFiles(fileList) {
            const all = Array.from(fileList || []);
            const accepted = all.filter(function(f){ return f && f.name && f.name.toLowerCase().endsWith('.zip'); });
            const skipped = all.length - accepted.length;
            accepted.forEach(function(file){ const item = createUploadItem(file); fileUploadQueue.push(item); });
            if (accepted.length > 0) showMessage('Added ' + accepted.length + ' file' + (accepted.length > 1 ? 's' : '') + ' to queue', 'info');
            if (skipped > 0) showMessage('Skipped ' + skipped + ' non-ZIP file' + (skipped > 1 ? 's' : ''), 'error');
            processUploadQueue();
        }

        function createUploadItem(file) {
            const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const row = document.createElement('div');
            row.className = 'upload-item';
            row.innerHTML = '<div class="upload-item-header">' +
                '<div class="upload-item-name">' + escapeHtml(file.name) + '</div>' +
                '<div class="upload-item-status">Queued</div>' +
            '</div>' +
            '<div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>';
            if (uploadsListEl) uploadsListEl.appendChild(row);
            return { id: id, file: file, row: row, fillEl: row.querySelector('.progress-fill'), statusEl: row.querySelector('.upload-item-status'), status: 'queued' };
        }

        function processUploadQueue() {
            while (activeFileUploads < MAX_PARALLEL_FILE_UPLOADS) {
                const next = fileUploadQueue.find(function(it){ return it.status === 'queued'; });
                if (!next) break;
                startFileUpload(next);
            }
        }

        async function startFileUpload(item) {
            item.status = 'uploading';
            if (item.statusEl) item.statusEl.textContent = 'Uploading...';
            activeFileUploads++;
            try {
                const result = await uploadManager.uploadFile(item.file, function(p){ if (item.fillEl) item.fillEl.style.width = p + '%'; if (item.statusEl) item.statusEl.textContent = 'Uploading ' + p + '%'; });
                if (item.fillEl) item.fillEl.style.width = '100%';
                if (item.statusEl) item.statusEl.textContent = 'Completed';
                showMessage('✅ Uploaded: ' + item.file.name + ' (key: ' + (result && result.key ? result.key : 'n/a') + ')', 'success');
                item.status = 'done';
            } catch (err) {
                if (item.statusEl) item.statusEl.textContent = 'Failed: ' + (err && err.message ? err.message : 'error');
                showMessage('❌ Failed: ' + item.file.name + ' — ' + (err && err.message ? err.message : 'error'), 'error');
                item.status = 'failed';
            } finally {
                activeFileUploads--;
                processUploadQueue();
            }
        }

        function escapeHtml(s) {
            const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
            return String(s).replace(/[&<>"']/g, function(ch){ return map[ch]; });
        }
        function showMessage(text, type) { var m = document.getElementById('message'); if (m) m.innerHTML = '<div class="message ' + type + '\">' + text + '</div>'; }
        
        // Files logic
        const PAGE_SIZE = 10; let currentPrefix = null; let currentCursor = null; let cachedFolders = []; let cachedFiles = []; let cachedTruncated = false; let cachedCursor = null; let currentSort = 'name_asc'; let filterText = ''; let pageCursors = [null]; let currentPageIndex = 0;
        // Global search state
        let searchMode = false; let searchResults = []; let searchTruncated = false; let searchCursor = null; let searchPageCursors = [null]; let searchPageIndex = 0; let activeSearchQuery = '';
        function normalizePrefix(p) { let v = (p || 'unzipped/'); try { v = decodeURIComponent(v); } catch {} if (!v.startsWith('unzipped/')) v = 'unzipped/'; if (!v.endsWith('/')) v = v + '/'; return v; }
        function getPrefixFromUrl() { const params = new URLSearchParams(location.search); return normalizePrefix(params.get('prefix') || 'unzipped/'); }
        function setUrlPrefix(prefix) { const url = new URL(location.href); url.pathname = '/files'; url.searchParams.set('prefix', prefix); history.pushState({ prefix }, '', url); }
        function getFolderName(prefix) { const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix; const parts = trimmed.split('/'); return (parts[parts.length - 1] || '') + '/'; }
        function buildBreadcrumb(prefix) { const bc = document.getElementById('breadcrumb'); if (!bc) return; const parts = prefix.split('/').filter(Boolean); let acc = ''; const segs = parts.map(function(name){ acc += name + '/'; return { name: name + '/', prefix: acc }; }); bc.innerHTML = segs.map(function(seg, idx){ var isLast = idx === segs.length - 1; var link = isLast ? '<span>' + seg.name + '</span>' : '<a href="#" data-prefix="' + seg.prefix + '">' + seg.name + '</a>'; return idx === 0 ? link : '<span class="breadcrumb-sep">›</span>' + link; }).join(' '); }
        async function loadFiles(cursor, pageIndex) { try { const prefix = getPrefixFromUrl(); if (typeof cursor === 'undefined') cursor = pageCursors[currentPageIndex] || null; if (typeof pageIndex !== 'number') pageIndex = currentPageIndex; const firstPage = currentPrefix !== prefix && !cursor; if (firstPage) document.getElementById('filesList').innerHTML = '<div class="loading">Loading files...</div>'; if (currentPrefix !== prefix) { currentPrefix = prefix; currentCursor = null; } const qs = new URLSearchParams({ prefix: currentPrefix }); if (cursor) qs.set('cursor', cursor); qs.set('limit', String(PAGE_SIZE)); const response = await fetch(BACKEND_URL + '/api/files?' + qs.toString()); if (!response.ok) throw new Error('Failed to load files'); const data = await response.json(); cachedFolders = data.folders || []; cachedFiles = data.files || []; cachedTruncated = !!data.truncated; cachedCursor = data.truncated ? data.cursor : null; currentCursor = cachedCursor; currentPageIndex = pageIndex; pageCursors[pageIndex] = cursor || null; pageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null; buildBreadcrumb(currentPrefix); renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } catch (error) { document.getElementById('filesList').innerHTML = '<div class="loading">Error loading files: ' + error.message + '</div>'; } }
        async function loadSearch(cursor, pageIndex) { try { const q = (activeSearchQuery || '').trim(); const prefix = getPrefixFromUrl(); if (!q) { searchMode = false; renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); return; } if (typeof cursor === 'undefined') cursor = searchPageCursors[searchPageIndex] || null; if (typeof pageIndex !== 'number') pageIndex = searchPageIndex; const firstPage = (searchPageIndex !== pageIndex) || (!cursor && searchCursor === null); if (firstPage) document.getElementById('filesList').innerHTML = '<div class="loading">Searching...</div>'; const qs = new URLSearchParams({ prefix: prefix, q: q }); if (cursor) qs.set('cursor', cursor); qs.set('limit', String(PAGE_SIZE)); const response = await fetch(BACKEND_URL + '/api/search?' + qs.toString()); if (!response.ok) throw new Error('Search failed'); const data = await response.json(); searchResults = data.files || []; searchTruncated = !!data.truncated; searchCursor = data.truncated ? data.cursor : null; searchPageIndex = pageIndex; searchPageCursors[pageIndex] = cursor || null; searchPageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null; buildBreadcrumb(prefix); renderSearch({ files: searchResults, truncated: searchTruncated, cursor: searchCursor }, false); } catch (error) { document.getElementById('filesList').innerHTML = '<div class="loading">Search error: ' + error.message + '</div>'; } }
        function renderListing(data, append) { const filesList = document.getElementById('filesList'); if (!filesList) return; if (!append) filesList.innerHTML = ''; let folders = (data.folders || []); let files = (data.files || []); folders = folders.filter(function(f){ var name = getFolderName(f); return !name.startsWith('__'); }); files = files.filter(function(f){ var n = (f.filename || ''); return !n.startsWith('__'); }); if (filterText) { var q = filterText; folders = folders.filter(function(f){ return getFolderName(f).toLowerCase().indexOf(q) !== -1; }); files = files.filter(function(f){ return (f.filename || '').toLowerCase().indexOf(q) !== -1; }); } function byName(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); } function byDate(a, b) { return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(); } function bySize(a, b) { return a.size - b.size; } folders = folders.slice().sort(function(a, b){ var an = getFolderName(a); var bn = getFolderName(b); if (currentSort === 'name_desc') return byName(bn, an); return byName(an, bn); }); files = files.slice().sort(function(a, b){ switch (currentSort) { case 'name_desc': return byName(a.filename, b.filename) * -1; case 'date_desc': return byDate(a, b) * -1; case 'date_asc': return byDate(a, b); case 'size_desc': return bySize(a, b) * -1; case 'size_asc': return bySize(a, b); default: return byName(a.filename, b.filename); } }); var statsEl = document.getElementById('stats'); if (statsEl) statsEl.textContent = folders.length + ' folders · ' + files.length + ' files'; const foldersHtml = folders.map(function(folder){ return '<div class="file-item" data-prefix="' + encodeURIComponent(folder) + '"><div class="file-name">📁 ' + getFolderName(folder) + '</div><div class="file-size">-</div><div class="file-date">-</div><div class="file-actions"></div></div>'; }).join(''); const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); return '<div class="file-item" data-key="' + encodedKey + '"><div class="file-name">' + file.filename + '</div><div class="file-size">' + (function(b){ if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]; })(file.size) + '</div><div class="file-date">' + new Date(file.lastModified).toLocaleString() + '</div><div class="file-actions"><button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button><button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button></div></div>'; }).join(''); const content = foldersHtml + filesHtml; if (!append && content.trim() === '') { filesList.innerHTML = '<div class="no-files">Empty folder</div>'; } else { filesList.insertAdjacentHTML('beforeend', content); } var existingPager = document.getElementById('paginationRow'); if (existingPager) existingPager.remove(); var canPrev = currentPageIndex > 0; var canNext = !!(data.truncated && data.cursor); filesList.insertAdjacentHTML('beforeend', '<div id="paginationRow" class="file-item"><div class="file-name"></div><div class="file-size"></div><div class="file-date">Page ' + (currentPageIndex + 1) + '</div><div class="file-actions"><button class="action-button" id="prevPageBtn"' + (canPrev ? '' : ' disabled') + '>Prev</button><button class="action-button" id="nextPageBtn"' + (canNext ? '' : ' disabled') + '>Next</button></div></div>'); var nextBtn = document.getElementById('nextPageBtn'); if (nextBtn) nextBtn.addEventListener('click', function(){ if (!cachedCursor) return; loadFiles(pageCursors[currentPageIndex + 1] || cachedCursor, currentPageIndex + 1); }); var prevBtn = document.getElementById('prevPageBtn'); if (prevBtn) prevBtn.addEventListener('click', function(){ if (currentPageIndex <= 0) return; loadFiles(pageCursors[currentPageIndex - 1] || null, currentPageIndex - 1); }); }
        function renderSearch(data, append) { const filesList = document.getElementById('filesList'); if (!filesList) return; if (!append) filesList.innerHTML = ''; let files = (data.files || []); files = files.filter(function(f){ var n = (f.filename || ''); return !n.startsWith('__'); }); function byName(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); } function byDate(a, b) { return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(); } function bySize(a, b) { return a.size - b.size; } files = files.slice().sort(function(a, b){ switch (currentSort) { case 'name_desc': return byName(a.filename, b.filename) * -1; case 'date_desc': return byDate(a, b) * -1; case 'date_asc': return byDate(a, b); case 'size_desc': return bySize(a, b) * -1; case 'size_asc': return bySize(a, b); default: return byName(a.filename, b.filename); } }); var statsEl = document.getElementById('stats'); if (statsEl) statsEl.textContent = files.length + ' results'; const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); return '<div class="file-item" data-key="' + encodedKey + '"><div class="file-name">' + file.filename + '</div><div class="file-size">' + (function(b){ if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]; })(file.size) + '</div><div class="file-date">' + new Date(file.lastModified).toLocaleString() + '</div><div class="file-actions"><button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button><button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button></div></div>'; }).join(''); const content = filesHtml; if (!append && content.trim() === '') { filesList.innerHTML = '<div class="no-files">No results</div>'; } else { filesList.insertAdjacentHTML('beforeend', content); } var existingPager = document.getElementById('paginationRow'); if (existingPager) existingPager.remove(); var canPrev = searchPageIndex > 0; var canNext = !!(data.truncated && data.cursor); filesList.insertAdjacentHTML('beforeend', '<div id="paginationRow" class="file-item"><div class="file-name"></div><div class="file-size"></div><div class="file-date">Page ' + (searchPageIndex + 1) + '</div><div class="file-actions"><button class="action-button" id="prevPageBtn"' + (canPrev ? '' : ' disabled') + '>Prev</button><button class="action-button" id="nextPageBtn"' + (canNext ? '' : ' disabled') + '>Next</button></div></div>'); var nextBtn = document.getElementById('nextPageBtn'); if (nextBtn) nextBtn.addEventListener('click', function(){ if (!searchCursor) return; loadSearch(searchPageCursors[searchPageIndex + 1] || searchCursor, searchPageIndex + 1); }); var prevBtn = document.getElementById('prevPageBtn'); if (prevBtn) prevBtn.addEventListener('click', function(){ if (searchPageIndex <= 0) return; loadSearch(searchPageCursors[searchPageIndex - 1] || null, searchPageIndex - 1); }); }
        async function downloadFile(key) { try { const response = await fetch(BACKEND_URL + '/api/files/' + key); if (!response.ok) throw new Error('Failed to download file'); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = key.split('/').pop(); document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); } catch (error) { alert('Download failed: ' + error.message); } }
        async function deleteFile(key) { if (!confirm('Are you sure you want to delete this file?')) return; try { const response = await fetch(BACKEND_URL + '/api/files/' + key, { method: 'DELETE' }); if (!response.ok) throw new Error('Failed to delete file'); loadFiles(); } catch (error) { alert('Delete failed: ' + error.message); } }
        (function toolbar(){ var searchInput = document.getElementById('searchInput'); var sortSelect = document.getElementById('sortSelect'); var refreshBtn = document.getElementById('refreshBtn'); if (searchInput) searchInput.addEventListener('input', function(e){ var q = (e.target.value || '').toLowerCase().trim(); filterText = q; activeSearchQuery = q; if (q) { searchMode = true; searchPageCursors = [null]; searchPageIndex = 0; loadSearch(null, 0); } else { searchMode = false; searchResults = []; searchTruncated = false; searchCursor = null; renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } }); if (sortSelect) sortSelect.addEventListener('change', function(e){ currentSort = e.target.value || 'name_asc'; if (searchMode) { renderSearch({ files: searchResults, truncated: searchTruncated, cursor: searchCursor }, false); } else { renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } }); if (refreshBtn) refreshBtn.addEventListener('click', function(){ if (searchMode) { searchPageCursors = [null]; searchPageIndex = 0; loadSearch(null, 0); } else { loadFiles(); } }); })();
        (function listDelegation(){ var list = document.getElementById('filesList'); if (!list) return; list.addEventListener('click', function(e){ var row = e.target && e.target.closest && e.target.closest('.file-item[data-prefix]'); if (row && row.getAttribute) { e.preventDefault(); var encoded = row.getAttribute('data-prefix'); if (encoded) navigateToPrefix(decodeURIComponent(encoded)); return; } var btn = e.target && e.target.closest && e.target.closest('button[data-action]'); if (btn && btn.getAttribute) { e.preventDefault(); var action = btn.getAttribute('data-action'); var encodedKey = btn.getAttribute('data-key') || ''; var key = encodedKey ? decodeURIComponent(encodedKey) : ''; if (action === 'download') return downloadFile(key); if (action === 'delete') return deleteFile(key); } }); var bc = document.getElementById('breadcrumb'); if (bc) bc.addEventListener('click', function(e){ var a = e.target && e.target.closest && e.target.closest('a[data-prefix]'); if (a && a.getAttribute) { e.preventDefault(); var p = a.getAttribute('data-prefix'); if (p) navigateToPrefix(p); } }); })();
        function navigateToPrefix(prefix) { setUrlPrefix(prefix); var si = document.getElementById('searchInput'); if (si) si.value = ''; filterText = ''; searchMode = false; activeSearchQuery = ''; searchResults = []; searchTruncated = false; searchCursor = null; pageCursors = [null]; currentPageIndex = 0; loadFiles(null, 0); }
    </script>
</body>
</html>
  `;
}

// Get upload page HTML
function getUploadPage(env) {
  const BACKEND_URL = env.BACKEND_WORKER_URL || '';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Large File Uploader</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        
        .content {
            padding: 2rem;
        }
        
        .nav {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            justify-content: center;
        }
        
        .nav-button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .nav-button.active {
            background: #667eea;
            color: white;
        }
        
        .nav-button:not(.active) {
            background: #f8f9fa;
            color: #666;
        }
        
        .nav-button:not(.active):hover {
            background: #e9ecef;
            transform: translateY(-2px);
        }
        
        .upload-area {
            border: 3px dashed #667eea;
            border-radius: 12px;
            padding: 3rem;
            text-align: center;
            background: #f8f9ff;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .upload-area:hover {
            border-color: #5a6fd8;
            background: #f0f2ff;
        }
        
        .upload-area.dragover {
            border-color: #4c63d2;
            background: #e8ebff;
            transform: scale(1.02);
        }
        
        .upload-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            color: #667eea;
        }
        
        .upload-text {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 1rem;
        }
        
        .file-input {
            display: none;
        }
        
        .upload-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .upload-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        
        .upload-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .progress-container {
            margin-top: 2rem;
            display: none;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .progress-text {
            text-align: center;
            margin-top: 0.5rem;
            color: #666;
            font-weight: 500;
        }
        
        .message {
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
            font-weight: 500;
        }
        
        .message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .message.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        .file-info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
            display: none;
        }
        
        .file-info h3 {
            color: #333;
            margin-bottom: 0.5rem;
        }
        
        .file-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 0.5rem;
        }
        
        .file-detail {
            text-align: center;
        }
        
        .file-detail-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 0.25rem;
        }
        
        .file-detail-value {
            font-weight: 600;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Large File Uploader</h1>
            <p>Upload files up to 5GB with multipart support</p>
        </div>
        
        <div class="content">
            <nav class="nav">
                <a href="/upload" class="nav-button active">Upload Files</a>
                <a href="/files" class="nav-button">View Files</a>
            </nav>
            
            <div class="upload-area" id="uploadArea">
                <div class="upload-icon">📁</div>
                <div class="upload-text">Drag and drop your ZIP file here, or click to select</div>
                <input type="file" id="fileInput" class="file-input" accept=".zip">
            </div>
            
            <div class="file-info" id="fileInfo">
                <h3>Selected File</h3>
                <div class="file-details">
                    <div class="file-detail">
                        <div class="file-detail-label">Name</div>
                        <div class="file-detail-value" id="fileName">-</div>
                    </div>
                    <div class="file-detail">
                        <div class="file-detail-label">Size</div>
                        <div class="file-detail-value" id="fileSize">-</div>
                    </div>
                    <div class="file-detail">
                        <div class="file-detail-label">Type</div>
                        <div class="file-detail-value" id="fileType">-</div>
                    </div>
                </div>
            </div>
            
            <div class="progress-container" id="progressContainer">
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <div class="progress-text" id="progressText">0%</div>
            </div>
            
            <div id="message"></div>
        </div>
    </div>

    <script>
        // Upload Manager class embedded for browser context
        class UploadManager {
            constructor(backendUrl, chunkSize = 8 * 1024 * 1024, maxConcurrent = 5) {
                this.backendUrl = backendUrl;
                this.chunkSize = chunkSize;
                this.maxConcurrent = maxConcurrent;
                this.activeUploads = new Map();
            }

            async uploadFile(file, onProgress) {
                const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                try {
                    if (file.size < 100 * 1024 * 1024) {
                        return await this.simpleUpload(file, fileId, onProgress);
                    }
                    return await this.multipartUpload(file, fileId, onProgress);
                } catch (error) {
                    console.error('Upload failed:', error);
                    throw error;
                }
            }

            async simpleUpload(file, fileId, onProgress) {
                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch(this.backendUrl + '/api/upload', {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    let errorMsg = 'Upload failed';
                    try {
                        const error = await response.json();
                        errorMsg = error.error || errorMsg;
                    } catch {}
                    throw new Error(errorMsg);
                }
                onProgress && onProgress(100);
                return await response.json();
            }

            async multipartUpload(file, fileId, onProgress) {
                const initResponse = await fetch(this.backendUrl + '/api/upload/multipart/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        size: file.size,
                        contentType: file.type || 'application/zip'
                    }),
                });
                if (!initResponse.ok) {
                    let errorMsg = 'Failed to initiate multipart upload';
                    try {
                        const error = await initResponse.json();
                        errorMsg = error.error || errorMsg;
                    } catch {}
                    throw new Error(errorMsg);
                }
                const { uploadId, key } = await initResponse.json();
                this.activeUploads.set(fileId, { uploadId, key, file });
                try {
                    const chunks = this.splitFileIntoChunks(file);
                    const parts = [];
                    for (let i = 0; i < chunks.length; i += this.maxConcurrent) {
                        const batch = chunks.slice(i, i + this.maxConcurrent);
                        const batchPromises = batch.map((chunk, index) => this.uploadChunk(key, uploadId, i + index + 1, chunk));
                        const batchResults = await Promise.allSettled(batchPromises);
                        for (const result of batchResults) {
                            if (result.status === 'fulfilled') {
                                parts.push(result.value);
                            } else {
                                throw new Error('Chunk upload failed: ' + (result.reason && result.reason.message ? result.reason.message : 'unknown error'));
                            }
                        }
                        const progress = Math.round(((i + batch.length) / chunks.length) * 100);
                        onProgress && onProgress(progress);
                    }
                    const completeResponse = await fetch(this.backendUrl + '/api/upload/multipart/complete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            key,
                            uploadId,
                            parts: parts.map(function(p){ return { PartNumber: p.partNumber, ETag: p.etag }; })
                        }),
                    });
                    if (!completeResponse.ok) {
                        let errorMsg = 'Failed to complete multipart upload';
                        try {
                            const error = await completeResponse.json();
                            errorMsg = error.error || errorMsg;
                        } catch {}
                        throw new Error(errorMsg);
                    }
                    const result = await completeResponse.json();
                    this.activeUploads.delete(fileId);
                    onProgress && onProgress(100);
                    return result;
                } catch (error) {
                    try {
                        await fetch(this.backendUrl + '/api/upload/multipart/abort', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key, uploadId })
                        });
                    } catch (abortError) {
                        console.error('Failed to abort multipart upload:', abortError);
                    }
                    this.activeUploads.delete(fileId);
                    throw error;
                }
            }

            splitFileIntoChunks(file) {
                const chunks = [];
                let offset = 0;
                while (offset < file.size) {
                    const end = Math.min(offset + this.chunkSize, file.size);
                    chunks.push(file.slice(offset, end));
                    offset = end;
                }
                return chunks;
            }

            async uploadChunk(key, uploadId, partNumber, chunk) {
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('key', key);
                formData.append('uploadId', uploadId);
                formData.append('partNumber', String(partNumber));
                const response = await fetch(this.backendUrl + '/api/upload/multipart/part', {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    let errorMsg = 'Failed to upload part ' + partNumber;
                    try {
                        const error = await response.json();
                        errorMsg = error.error || errorMsg;
                    } catch {}
                    throw new Error(errorMsg);
                }
                return await response.json();
            }
        }

        const BACKEND_URL = ${JSON.stringify(BACKEND_URL)}; // injected from env
        
        const uploadManager = new UploadManager(BACKEND_URL);
        
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        // File input change handler
        fileInput.addEventListener('change', handleFileSelect);
        
        // Drag and drop handlers
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        uploadArea.addEventListener('click', () => fileInput.click());
        
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                selectFile(file);
            }
        }
        
        function handleDragOver(event) {
            event.preventDefault();
            uploadArea.classList.add('dragover');
        }
        
        function handleDragLeave(event) {
            event.preventDefault();
            uploadArea.classList.remove('dragover');
        }
        
        function handleDrop(event) {
            event.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                selectFile(files[0]);
            }
        }
        
        function selectFile(file) {
            if (!file.name.toLowerCase().endsWith('.zip')) {
                showMessage('Please select a ZIP file', 'error');
                return;
            }
            
            // Update file info display
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            document.getElementById('fileType').textContent = file.type || 'application/zip';
            
            fileInfo.style.display = 'block';
            
            // Start upload
            uploadFile(file);
        }
        
        async function uploadFile(file) {
            try {
                showMessage('Starting upload...', 'info');
                progressContainer.style.display = 'block';
                
                const result = await uploadManager.uploadFile(file, (progress) => {
                    progressFill.style.width = progress + '%';
                    progressText.textContent = progress + '%';
                    if (progress > 0 && progress < 100) {
                        showMessage('Uploading', 'info');
                    }
                });
                
                showMessage(\`✅ File uploaded successfully! Key: \${result.key}\`, 'success');
                
                // Reset form
                fileInput.value = '';
                fileInfo.style.display = 'none';
                progressContainer.style.display = 'none';
                
            } catch (error) {
                showMessage(\`❌ Upload failed: \${error.message}\`, 'error');
                progressContainer.style.display = 'none';
            }
        }
        
        function showMessage(text, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.innerHTML = \`<div class="message \${type}">\${text}</div>\`;
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    </script>
</body>
</html>
  `;
}

// Get files page HTML
function getFilesPage(env) {
  const BACKEND_URL = env.BACKEND_WORKER_URL || '';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uploaded Files</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        
        .content {
            padding: 2rem;
        }
        
        .nav {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            justify-content: center;
        }
        
        .nav-button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .nav-button.active {
            background: #667eea;
            color: white;
        }
        
        .nav-button:not(.active) {
            background: #f8f9fa;
            color: #666;
        }
        
        .nav-button:not(.active):hover {
            background: #e9ecef;
            transform: translateY(-2px);
        }
        
        .files-container {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
        }
        
        .files-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .breadcrumb {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
            color: #666;
        }
        .breadcrumb a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .breadcrumb a:hover {
            text-decoration: underline;
        }
        .breadcrumb-sep {
            color: #999;
        }
        
        .toolbar {
            display: flex;
            gap: 0.75rem;
            align-items: center;
            margin-bottom: 0.75rem;
            flex-wrap: wrap;
        }
        .search-input {
            flex: 1;
            min-width: 200px;
            padding: 8px 12px;
            border: 1px solid #e3e6ef;
            border-radius: 6px;
        }
        .sort-select {
            padding: 8px 12px;
            border: 1px solid #e3e6ef;
            border-radius: 6px;
            background: #fff;
        }
        .stats {
            color: #777;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        .list-header {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 1rem;
            padding: 0.75rem 1rem;
            font-weight: 600;
            color: #444;
            background: #f3f4f6;
            position: sticky;
            top: 0;
            z-index: 1;
            border-bottom: 1px solid #e9ecef;
        }
        
        .refresh-button {
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .files-list {
            background: white;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .file-item {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 1rem;
            padding: 1rem;
            border-bottom: 1px solid #e9ecef;
            align-items: center;
        }
        
        .file-item:last-child {
            border-bottom: none;
        }
        
        .file-item:hover {
            background: #f8f9ff;
        }
        
        .file-name {
            font-weight: 500;
            color: #333;
        }
        
        .file-size {
            color: #666;
        }
        
        .file-date {
            color: #666;
            font-size: 0.9rem;
        }
        
        .file-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .action-button {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        .download-button {
            background: #007bff;
            color: white;
        }
        
        .delete-button {
            background: #dc3545;
            color: white;
        }
        
        .loading {
            text-align: center;
            padding: 2rem;
            color: #666;
        }
        
        .no-files {
            text-align: center;
            padding: 2rem;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📁 Uploaded Files</h1>
            <p>Manage your uploaded files</p>
        </div>
        
        <div class="content">
            <nav class="nav">
                <a href="/upload" class="nav-button">Upload Files</a>
                <a href="/files" class="nav-button active">View Files</a>
            </nav>
            
            <div class="files-container">
                <div class="files-header">
                    <h3>Files</h3>
                    <button class="refresh-button" onclick="loadFiles()">Refresh</button>
                </div>
                <div id="breadcrumb" class="breadcrumb"></div>
                <div class="toolbar">
                    <input id="searchInput" class="search-input" placeholder="Filter by name..." />
                    <select id="sortSelect" class="sort-select">
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
        </div>
    </div>

    <script>
        const BACKEND_URL = ${JSON.stringify(BACKEND_URL)};

        let currentPrefix = null;
        let currentCursor = null;
        
        let cachedFolders = [];
        let cachedFiles = [];
        let cachedTruncated = false;
        let cachedCursor = null;
        let currentSort = 'name_asc';
        let filterText = '';
        const PAGE_SIZE = 10;
        let pageCursors = [null];
        let currentPageIndex = 0;

        function normalizePrefix(p) {
            let v = (p || 'unzipped/');
            try { v = decodeURIComponent(v); } catch {}
            if (!v.startsWith('unzipped/')) v = 'unzipped/';
            if (!v.endsWith('/')) v = v + '/';
            return v;
        }

        function getPrefixFromUrl() {
            const params = new URLSearchParams(location.search);
            return normalizePrefix(params.get('prefix') || 'unzipped/');
        }

        function setUrlPrefix(prefix) {
            const url = new URL(location.href);
            url.searchParams.set('prefix', prefix);
            history.pushState({ prefix }, '', url);
        }

        function getFolderName(prefix) {
            const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
            const parts = trimmed.split('/');
            return (parts[parts.length - 1] || '') + '/';
        }

        function buildBreadcrumb(prefix) {
            const bc = document.getElementById('breadcrumb');
            const parts = prefix.split('/').filter(Boolean);
            let acc = '';
            const segments = parts.map((name) => {
                acc += name + '/';
                return { name: name + '/', prefix: acc };
            });
            bc.innerHTML = segments.map((seg, idx) => {
                const isLast = idx === segments.length - 1;
                const link = isLast 
                  ? \`<span>\${seg.name}</span>\`
                  : \`<a href="#" onclick="navigateToPrefix('\${seg.prefix}')">\${seg.name}</a>\`;
                return idx === 0 ? link : \`<span class="breadcrumb-sep">›</span>\${link}\`;
            }).join(' ');
        }
        
        async function loadFiles(cursor, pageIndex) {
            try {
                const prefix = getPrefixFromUrl();
                if (typeof cursor === 'undefined') {
                    cursor = pageCursors[currentPageIndex] || null;
                }
                if (typeof pageIndex !== 'number') {
                    pageIndex = currentPageIndex;
                }
                const firstPage = currentPrefix !== prefix && !cursor;
                if (firstPage) {
                    document.getElementById('filesList').innerHTML = '<div class="loading">Loading files...</div>';
                }
                if (currentPrefix !== prefix) {
                    currentPrefix = prefix;
                    currentCursor = null;
                }

                const qs = new URLSearchParams({ prefix: currentPrefix });
                if (cursor) qs.set('cursor', cursor);
                qs.set('limit', String(PAGE_SIZE));

                const response = await fetch(BACKEND_URL + '/api/files?' + qs.toString());
                if (!response.ok) {
                    throw new Error('Failed to load files');
                }

                const data = await response.json();
                cachedFolders = data.folders || [];
                cachedFiles = data.files || [];
                cachedTruncated = !!data.truncated;
                cachedCursor = data.truncated ? data.cursor : null;
                currentCursor = cachedCursor;
                currentPageIndex = pageIndex;
                pageCursors[pageIndex] = cursor || null;
                pageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null;
                buildBreadcrumb(currentPrefix);
                renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false);

            } catch (error) {
                document.getElementById('filesList').innerHTML = 
                    '<div class="loading">Error loading files: ' + error.message + '</div>';
            }
        }
        
        function renderListing(data, append) {
            const filesList = document.getElementById('filesList');
            if (!append) filesList.innerHTML = '';

            let folders = (data.folders || []);
            let files = (data.files || []);

            // Exclude items that start with double underscores (e.g., __MACOSX)
            folders = folders.filter(function(f){
                var name = getFolderName(f);
                return !name.startsWith('__');
            });
            files = files.filter(function(f){
                var n = (f.filename || '');
                return !n.startsWith('__');
            });

            if (filterText) {
                var q = filterText;
                folders = folders.filter(function(f){ return getFolderName(f).toLowerCase().indexOf(q) !== -1; });
                files = files.filter(function(f){ return (f.filename || '').toLowerCase().indexOf(q) !== -1; });
            }

            function byName(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); }
            function byDate(a, b) { return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(); }
            function bySize(a, b) { return a.size - b.size; }

            folders = folders.slice().sort(function(a, b){
                var an = getFolderName(a);
                var bn = getFolderName(b);
                if (currentSort === 'name_desc') return byName(bn, an);
                return byName(an, bn);
            });

            files = files.slice().sort(function(a, b){
                switch (currentSort) {
                    case 'name_desc': return byName(a.filename, b.filename) * -1;
                    case 'date_desc': return byDate(a, b) * -1;
                    case 'date_asc': return byDate(a, b);
                    case 'size_desc': return bySize(a, b) * -1;
                    case 'size_asc': return bySize(a, b);
                    default: return byName(a.filename, b.filename);
                }
            });

            var statsEl = document.getElementById('stats');
            if (statsEl) {
                statsEl.textContent = folders.length + ' folders · ' + files.length + ' files';
            }

            const foldersHtml = folders.map(function(folder){ return '<div class="file-item" data-prefix="' + encodeURIComponent(folder) + '">' +
                    '<div class="file-name">📁 ' + getFolderName(folder) + '</div>' +
                    '<div class="file-size">-</div>' +
                    '<div class="file-date">-</div>' +
                    '<div class="file-actions"></div>' +
                '</div>'; }).join('');

            const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); return '<div class="file-item" data-key="' + encodedKey + '">' +
                    '<div class="file-name">' + file.filename + '</div>' +
                    '<div class="file-size">' + formatFileSize(file.size) + '</div>' +
                    '<div class="file-date">' + formatDate(file.lastModified) + '</div>' +
                    '<div class="file-actions">' +
                        '<button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button>' +
                        '<button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button>' +
                    '</div>' +
                '</div>'; }).join('');

            const content = foldersHtml + filesHtml;
            if (!append && content.trim() === '') {
                filesList.innerHTML = '<div class="no-files">Empty folder</div>';
            } else {
                filesList.insertAdjacentHTML('beforeend', content);
            }

            const existingLoadMore = document.getElementById('loadMoreRow');
            if (existingLoadMore) existingLoadMore.remove();
            var existingPager = document.getElementById('paginationRow');
            if (existingPager) existingPager.remove();
            var canPrev = currentPageIndex > 0;
            var canNext = !!(data.truncated && data.cursor);
            filesList.insertAdjacentHTML('beforeend', 
                '<div id="paginationRow" style="display:flex;justify-content:center;align-items:center;gap:8px;padding:12px;">' +
                    '<button onclick="goPrevPage()"' + (canPrev ? '' : ' disabled') + ' style="background:none;border:1px solid #e3e6ef;color:#667eea;padding:6px 10px;border-radius:999px;cursor:pointer;' + (canPrev ? '' : 'opacity:.5;cursor:not-allowed;') + '">‹ Prev</button>' +
                    '<span style="font-size:0.9rem;color:#666;">Page ' + (currentPageIndex + 1) + '</span>' +
                    '<button onclick="goNextPage()"' + (canNext ? '' : ' disabled') + ' style="background:none;border:1px solid #e3e6ef;color:#667eea;padding:6px 10px;border-radius:999px;cursor:pointer;' + (canNext ? '' : 'opacity:.5;cursor:not-allowed;') + '">Next ›</button>' +
                '</div>'
            );
        }
        
        async function downloadFile(key) {
            try {
                const response = await fetch(BACKEND_URL + '/api/files/' + key);
                
                if (!response.ok) {
                    throw new Error('Failed to download file');
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = key.split('/').pop();
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
            } catch (error) {
                alert('Download failed: ' + error.message);
            }
        }
        
        async function deleteFile(key) {
            if (!confirm('Are you sure you want to delete this file?')) {
                return;
            }
            
            try {
                const response = await fetch(BACKEND_URL + '/api/files/' + key, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete file');
                }
                
                loadFiles(); // Refresh the list
                
            } catch (error) {
                alert('Delete failed: ' + error.message);
            }
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function formatDate(dateString) {
            return new Date(dateString).toLocaleString();
        }
        
        function navigateToPrefix(prefix) {
            setUrlPrefix(prefix);
            pageCursors = [null];
            currentPageIndex = 0;
            loadFiles(null, 0);
        }

        // Wire toolbar
        (function(){
            var searchInput = document.getElementById('searchInput');
            var sortSelect = document.getElementById('sortSelect');
            if (searchInput) {
                searchInput.addEventListener('input', function(e){
                    filterText = (e.target.value || '').toLowerCase();
                    renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false);
                });
            }
            if (sortSelect) {
                sortSelect.addEventListener('change', function(e){
                    currentSort = e.target.value || 'name_asc';
                    renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false);
                });
            }
        })();

        function goNextPage() {
            if (!cachedCursor) return;
            loadFiles(pageCursors[currentPageIndex + 1] || cachedCursor, currentPageIndex + 1);
        }

        function goPrevPage() {
            if (currentPageIndex <= 0) return;
            loadFiles(pageCursors[currentPageIndex - 1] || null, currentPageIndex - 1);
        }

        // Handle browser navigation
        window.addEventListener('popstate', () => { pageCursors = [null]; currentPageIndex = 0; loadFiles(null, 0); });
        
        // Load files on page load
        loadFiles(null, 0);

        // Delegated actions for navigation and file actions
        (function(){
            var list = document.getElementById('filesList');
            if (!list) return;
            list.addEventListener('click', function(e){
                var row = e.target && e.target.closest && e.target.closest('.file-item[data-prefix]');
                if (row && row.getAttribute) {
                    e.preventDefault();
                    var encoded = row.getAttribute('data-prefix');
                    if (encoded) navigateToPrefix(decodeURIComponent(encoded));
                    return;
                }
                var btn = e.target && e.target.closest && e.target.closest('button[data-action]');
                if (btn && btn.getAttribute) {
                    e.preventDefault();
                    var action = btn.getAttribute('data-action');
                    var encodedKey = btn.getAttribute('data-key') || '';
                    var key = encodedKey ? decodeURIComponent(encodedKey) : '';
                    if (action === 'download') return downloadFile(key);
                    if (action === 'delete') return deleteFile(key);
                }
            });
        })();
    </script>
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

