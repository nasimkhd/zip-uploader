export const APP_JS = `
// Config
const BACKEND_URL = (window.__CONFIG__ && window.__CONFIG__.BACKEND_URL) || '';
const API_KEY = (window.__CONFIG__ && window.__CONFIG__.API_KEY) || '';

// Helper function to create authenticated fetch options
function getAuthHeaders(additionalHeaders = {}) {
  const headers = { ...additionalHeaders };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

// Helper function to handle API errors with 401 detection
async function handleApiResponse(response) {
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
    if (errorData.code === 'MISSING_KEY' || errorData.code === 'INVALID_KEY') {
      throw new Error('Authentication failed. Please check your API key configuration.');
    }
    throw new Error(errorData.error || 'Unauthorized access');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || 'Request failed');
  }
  return response;
}

// Theme
(function themeInit(){
  function applyTheme(mode){
    if (mode === 'light') { document.body.classList.add('light'); }
    else { document.body.classList.remove('light'); }
  }
  var saved = localStorage.getItem('theme') || 'auto';
  if (saved === 'auto') {
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
  } else {
    applyTheme(saved);
  }
  var tbtn = document.getElementById('themeToggle');
  if (tbtn) tbtn.addEventListener('click', function(){
    var isLight = document.body.classList.contains('light');
    var next = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
})();

// Fast SHA-256 using native browser crypto API (much faster than JS implementation)
async function computeBlobSHA256(blob, onProgress, chunkSize) {
    // Use native crypto.subtle.digest() which is much faster and non-blocking
    const size = blob.size;
    const step = chunkSize || (8 * 1024 * 1024); // 8MB chunks - good balance
    let offset = 0;
    const chunks = [];
    
    // Read file in chunks with frequent yielding to keep UI responsive
    while (offset < size) {
        const end = Math.min(offset + step, size);
        const chunk = blob.slice(offset, end);
        const ab = await chunk.arrayBuffer();
        chunks.push(new Uint8Array(ab));
        offset = end;
        
        // Update progress
        if (onProgress) {
            const p = Math.floor((offset / size) * 100);
            try { onProgress(p); } catch {}
        }
        
        // Yield to event loop every 2 chunks to keep UI responsive without excessive overhead
        if (chunks.length % 2 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // Combine all chunks (native crypto API is fast enough to handle this efficiently)
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) {
        combined.set(chunk, pos);
        pos += chunk.length;
    }
    
    // Compute hash using native crypto API (much faster than JS implementation)
    // This runs in a background thread and doesn't block the UI
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');
}

async function computeFileSHA256(file, onProgress, chunkSize) {
    return computeBlobSHA256(file, onProgress, chunkSize);
}

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
    var contentEl = document.querySelector('.content');
    if (contentEl) contentEl.classList.toggle('upload-mode', route === 'upload');
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
            // 1) Compute checksum first (uses native crypto API - fast and non-blocking)
            let lastHashProgress = 0;
            const sha256 = await computeFileSHA256(
                file,
                function(p){
                    lastHashProgress = p;
                    if (onProgress) {
                        try { onProgress({ phase: 'hash', percent: p }); } catch {}
                    }
                },
                32 * 1024 * 1024 // 32MB chunks - native API handles this efficiently
            );
            // 2) Upload with checksum
            if (file.size < 100 * 1024 * 1024) return await this.simpleUpload(file, fileId, onProgress, sha256);
            return await this.multipartUpload(file, fileId, onProgress, sha256);
        } catch (e) { console.error('Upload failed:', e); throw e; }
    }
    async simpleUpload(file, fileId, onProgress, sha256) {
        const fd = new FormData(); fd.append('file', file); if (sha256) fd.append('sha256', sha256);
        const res = await fetch(this.backendUrl + '/api/upload', { method: 'POST', headers: getAuthHeaders(), body: fd });
        await handleApiResponse(res);
        onProgress && onProgress(100); return await res.json();
    }
    async multipartUpload(file, fileId, onProgress, sha256) {
        const init = await fetch(this.backendUrl + '/api/upload/multipart/init', { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || 'application/zip', sha256: sha256 }) });
        await handleApiResponse(init);
        const { uploadId, key } = await init.json(); this.activeUploads.set(fileId, { uploadId, key, file });
        try {
            const chunks = this.splitFileIntoChunks(file); const parts = [];
            for (let i = 0; i < chunks.length; i += this.maxConcurrent) {
                const batch = chunks.slice(i, i + this.maxConcurrent);
                const results = await Promise.allSettled(batch.map((chunk, idx) => this.uploadChunk(key, uploadId, i + idx + 1, chunk)));
                for (const r of results) { if (r.status === 'fulfilled') parts.push(r.value); else throw new Error('Chunk upload failed: ' + (r.reason && r.reason.message ? r.reason.message : 'unknown error')); }
                const progress = Math.round(((i + batch.length) / chunks.length) * 100); onProgress && onProgress(progress);
            }
            const complete = await fetch(this.backendUrl + '/api/upload/multipart/complete', { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ key, uploadId, parts: parts.map(function(p){ return { PartNumber: p.partNumber, ETag: p.etag }; }) }) });
            await handleApiResponse(complete);
            const result = await complete.json(); this.activeUploads.delete(fileId); onProgress && onProgress(100); return result;
        } catch (err) {
            try { await fetch(this.backendUrl + '/api/upload/multipart/abort', { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ key, uploadId }) }); } catch (_) {}
            this.activeUploads.delete(fileId); throw err;
        }
    }
    splitFileIntoChunks(file) { const chunks = []; let offset = 0; while (offset < file.size) { const end = Math.min(offset + this.chunkSize, file.size); chunks.push(file.slice(offset, end)); offset = end; } return chunks; }
    async uploadChunk(key, uploadId, partNumber, chunk) { const fd = new FormData(); fd.append('chunk', chunk); fd.append('key', key); fd.append('uploadId', uploadId); fd.append('partNumber', String(partNumber)); const res = await fetch(this.backendUrl + '/api/upload/multipart/part', { method: 'POST', headers: getAuthHeaders(), body: fd }); await handleApiResponse(res); return await res.json(); }
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
    if (item.statusEl) item.statusEl.textContent = 'Hashing...';
    activeFileUploads++;
    try {
        const result = await uploadManager.uploadFile(item.file, function(p){
            var percent, phase;
            if (typeof p === 'number') { percent = p; phase = 'upload'; }
            else { percent = (p && typeof p.percent === 'number') ? p.percent : 0; phase = (p && p.phase) ? p.phase : 'upload'; }
            if (item.fillEl) item.fillEl.style.width = percent + '%';
            if (item.statusEl) item.statusEl.textContent = (phase === 'hash' ? 'Hashing ' : 'Uploading ') + percent + '%';
        });
        if (item.fillEl) item.fillEl.style.width = '100%';
        if (item.statusEl) item.statusEl.textContent = 'Completed';
        const correlationId = result && result.correlationId ? result.correlationId : null;
        const message = '✅ Uploaded: ' + item.file.name + ' (key: ' + (result && result.key ? result.key : 'n/a') + (correlationId ? ', correlation ID: ' + correlationId : '') + ')';
        showMessage(message, 'success');
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
function showMessage(text, type) { var m = document.getElementById('message'); if (m) m.innerHTML = '<div class="message ' + type + '">' + text + '</div>'; }
        
// Viewer modal helpers
const viewerModal = document.getElementById('viewerModal');
const viewerFrame = document.getElementById('viewerFrame');
const viewerPre = document.getElementById('viewerPre');
const viewerTitle = document.getElementById('viewerTitle');
const viewerOpenNewTab = document.getElementById('viewerOpenNewTab');
const viewerCloseBtn = document.getElementById('viewerClose');

function getPreviewUrl(key) { return BACKEND_URL + '/api/files-inline/' + encodeURIComponent(key); }
function showViewerModal() { if (viewerModal) { viewerModal.style.display = 'grid'; document.body.style.overflow = 'hidden'; } }
function hideViewerModal() { if (viewerModal) { viewerModal.style.display = 'none'; document.body.style.overflow = ''; if (viewerFrame) viewerFrame.src = 'about:blank'; if (viewerPre) { viewerPre.textContent = ''; viewerPre.style.display = 'none'; } if (viewerFrame) viewerFrame.style.display = 'none'; } }
function setViewerTitle(name) { if (viewerTitle) viewerTitle.textContent = name; }

async function openPreview(key) {
    try {
        const name = (key || '').split('/').pop() || 'file';
        const ext = (name.split('.').pop() || '').toLowerCase();
        const url = getPreviewUrl(key);
        setViewerTitle(name);
        if (viewerOpenNewTab) viewerOpenNewTab.href = url;
        if (ext === 'pdf') {
            if (viewerPre) viewerPre.style.display = 'none';
            if (viewerFrame) { viewerFrame.style.display = 'block'; viewerFrame.src = url; }
            showViewerModal();
            return;
        }
        if (ext === 'json' || ext === 'xml' || ext === 'txt') {
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to load preview');
            const text = await res.text();
            if (viewerFrame) { viewerFrame.style.display = 'none'; viewerFrame.src = 'about:blank'; }
            if (viewerPre) {
                viewerPre.style.display = 'block';
                if (ext === 'json') {
                    try { viewerPre.textContent = JSON.stringify(JSON.parse(text), null, 2); }
                    catch (_) { viewerPre.textContent = text; }
                } else {
                    viewerPre.textContent = text;
                }
            }
            showViewerModal();
            return;
        }
        window.open(url, '_blank');
    } catch (e) {
        alert('Preview failed: ' + (e && e.message ? e.message : 'error'));
    }
}

(function viewerBindings(){ if (viewerCloseBtn) viewerCloseBtn.addEventListener('click', function(){ hideViewerModal(); }); if (viewerModal) viewerModal.addEventListener('click', function(e){ if (e.target === viewerModal) hideViewerModal(); }); window.addEventListener('keydown', function(e){ if (e.key === 'Escape') hideViewerModal(); }); })();

// Files logic
const PAGE_SIZE = 6; let currentPrefix = null; let currentCursor = null; let cachedFolders = []; let cachedFiles = []; let cachedTruncated = false; let cachedCursor = null; let currentSort = 'name_asc'; let filterText = ''; let pageCursors = [null]; let currentPageIndex = 0;
// Global search state
let searchMode = false; let searchResults = []; let searchTruncated = false; let searchCursor = null; let searchPageCursors = [null]; let searchPageIndex = 0; let activeSearchQuery = '';
function normalizePrefix(p) { let v = (p || 'feeds/'); try { v = decodeURIComponent(v); } catch {} if (!v.startsWith('feeds/')) v = 'feeds/'; if (!v.endsWith('/')) v = v + '/'; return v; }
function getPrefixFromUrl() { const params = new URLSearchParams(location.search); return normalizePrefix(params.get('prefix') || 'feeds/'); }
function setUrlPrefix(prefix) { const url = new URL(location.href); url.pathname = '/files'; url.searchParams.set('prefix', prefix); history.pushState({ prefix }, '', url); }
function getFolderName(prefix) { const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix; const parts = trimmed.split('/'); return (parts[parts.length - 1] || '') + '/'; }
function buildBreadcrumb(prefix) { const bc = document.getElementById('breadcrumb'); if (!bc) return; const parts = prefix.split('/').filter(Boolean); let acc = ''; const segs = parts.map(function(name){ acc += name + '/'; return { name: name + '/', prefix: acc }; }); bc.innerHTML = segs.map(function(seg, idx){ var isLast = idx === segs.length - 1; var link = isLast ? '<span>' + seg.name + '</span>' : '<a href="#" data-prefix="' + seg.prefix + '">' + seg.name + '</a>'; return idx === 0 ? link : '<span class="breadcrumb-sep">›</span>' + link; }).join(' '); }
async function loadFiles(cursor, pageIndex) { try { const prefix = getPrefixFromUrl(); if (typeof cursor === 'undefined') cursor = pageCursors[currentPageIndex] || null; if (typeof pageIndex !== 'number') pageIndex = currentPageIndex; const firstPage = currentPrefix !== prefix && !cursor; if (firstPage) document.getElementById('filesList').innerHTML = '<div class="loading">Loading files...</div>'; if (currentPrefix !== prefix) { currentPrefix = prefix; currentCursor = null; } const qs = new URLSearchParams({ prefix: currentPrefix }); if (cursor) qs.set('cursor', cursor); qs.set('limit', String(PAGE_SIZE)); const response = await fetch(BACKEND_URL + '/api/files?' + qs.toString(), { headers: getAuthHeaders() }); if (!response.ok) throw new Error('Failed to load files'); const data = await response.json(); cachedFolders = data.folders || []; cachedFiles = data.files || []; cachedTruncated = !!data.truncated; cachedCursor = data.truncated ? data.cursor : null; currentCursor = cachedCursor; currentPageIndex = pageIndex; pageCursors[pageIndex] = cursor || null; pageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null; buildBreadcrumb(currentPrefix); renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } catch (error) { document.getElementById('filesList').innerHTML = '<div class="loading">Error loading files: ' + error.message + '</div>'; } }
async function loadSearch(cursor, pageIndex) { try { const q = (activeSearchQuery || '').trim(); const prefix = getPrefixFromUrl(); if (!q) { searchMode = false; renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); return; } if (typeof cursor === 'undefined') cursor = searchPageCursors[searchPageIndex] || null; if (typeof pageIndex !== 'number') pageIndex = searchPageIndex; const firstPage = (searchPageIndex !== pageIndex) || (!cursor && searchCursor === null); if (firstPage) document.getElementById('filesList').innerHTML = '<div class="loading">Searching...</div>'; const qs = new URLSearchParams({ prefix: prefix, q: q }); if (cursor) qs.set('cursor', cursor); qs.set('limit', String(PAGE_SIZE)); const response = await fetch(BACKEND_URL + '/api/search?' + qs.toString(), { headers: getAuthHeaders() }); if (!response.ok) throw new Error('Search failed'); const data = await response.json(); searchResults = data.files || []; searchTruncated = !!data.truncated; searchCursor = data.truncated ? data.cursor : null; searchPageIndex = pageIndex; searchPageCursors[pageIndex] = cursor || null; searchPageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null; buildBreadcrumb(prefix); renderSearch({ files: searchResults, truncated: searchTruncated, cursor: searchCursor }, false); } catch (error) { document.getElementById('filesList').innerHTML = '<div class="loading">Search error: ' + error.message + '</div>'; } }
function renderListing(data, append) { const filesList = document.getElementById('filesList'); if (!filesList) return; if (!append) filesList.innerHTML = ''; let folders = (data.folders || []); let files = (data.files || []); folders = folders.filter(function(f){ var name = getFolderName(f); return !name.startsWith('__'); }); files = files.filter(function(f){ var n = (f.filename || ''); var base = n.split('/').pop(); return !n.startsWith('__') && !base.startsWith('.'); }); if (filterText) { var q = filterText; folders = folders.filter(function(f){ return getFolderName(f).toLowerCase().indexOf(q) !== -1; }); files = files.filter(function(f){ return (f.filename || '').toLowerCase().indexOf(q) !== -1; }); } function byName(a, b) { var sa = (a || '').toString(); var sb = (b || '').toString(); return sa.localeCompare(sb, undefined, { sensitivity: 'base' }); } function byDate(a, b) { var da = a && a.lastModified ? new Date(a.lastModified).getTime() : 0; var db = b && b.lastModified ? new Date(b.lastModified).getTime() : 0; return da - db; } function bySize(a, b) { var sa = a && typeof a.size === 'number' ? a.size : 0; var sb = b && typeof b.size === 'number' ? b.size : 0; return sa - sb; } folders = folders.slice().sort(function(a, b){ var an = getFolderName(a); var bn = getFolderName(b); if (currentSort === 'name_desc') return byName(bn, an); return byName(an, bn); }); files = files.slice().sort(function(a, b){ switch (currentSort) { case 'name_desc': return byName(a && a.filename ? a.filename : '', b && b.filename ? b.filename : '') * -1; case 'date_desc': return byDate(a, b) * -1; case 'date_asc': return byDate(a, b); case 'size_desc': return bySize(a, b) * -1; case 'size_asc': return bySize(a, b); default: return byName(a && a.filename ? a.filename : '', b && b.filename ? b.filename : ''); } }); var statsEl = document.getElementById('stats'); if (statsEl) statsEl.textContent = folders.length + ' folders · ' + files.length + ' files'; const foldersHtml = folders.map(function(folder){ return '<div class="file-item" data-prefix="' + encodeURIComponent(folder) + '"><div class="file-name">📁 ' + getFolderName(folder) + '</div><div class="file-size">-</div><div class="file-date">-</div><div class="file-actions"></div></div>'; }).join(''); const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); var filename = file.filename || ''; var ext = (filename.split('.').pop() || '').toLowerCase(); var canPreview = (ext === 'pdf' || ext === 'xml' || ext === 'json' || ext === 'txt'); return '<div class="file-item" data-key="' + encodedKey + '"><div class="file-name">' + file.filename + '</div><div class="file-size">' + (function(b){ if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]; })(file.size) + '</div><div class="file-date">' + new Date(file.lastModified).toLocaleString() + '</div><div class="file-actions">' + (canPreview ? '<button class="action-button" data-action="preview" data-key="' + encodedKey + '">Open</button>' : '') + '<button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button><button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button></div></div>'; }).join(''); const content = foldersHtml + filesHtml; if (!append && content.trim() === '') { filesList.innerHTML = '<div class="no-files">Empty folder</div>'; } else { filesList.insertAdjacentHTML('beforeend', content); } var existingPager = document.getElementById('paginationRow'); if (existingPager) existingPager.remove(); var canPrev = currentPageIndex > 0; var canNext = !!(data.truncated && data.cursor); filesList.insertAdjacentHTML('beforeend', '<div id="paginationRow" style="display:flex;justify-content:center;align-items:center;padding:12px;">' + '<div style="display:inline-flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--border);border-radius:9999px;background:var(--surface);">' + '<button id="prevPageBtn"' + (canPrev ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canPrev ? 'pointer' : 'not-allowed') + ';opacity:' + (canPrev ? '1' : '.5') + '">‹</button>' + '<span style="font-size:12px;color:var(--muted);font-weight:700;">' + (currentPageIndex + 1) + '</span>' + '<button id="nextPageBtn"' + (canNext ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canNext ? 'pointer' : 'not-allowed') + ';opacity:' + (canNext ? '1' : '.5') + '">›</button>' + '</div>' + '</div>'); var nextBtn = document.getElementById('nextPageBtn'); if (nextBtn) nextBtn.addEventListener('click', function(){ if (!cachedCursor) return; loadFiles(pageCursors[currentPageIndex + 1] || cachedCursor, currentPageIndex + 1); }); var prevBtn = document.getElementById('prevPageBtn'); if (prevBtn) prevBtn.addEventListener('click', function(){ if (currentPageIndex <= 0) return; loadFiles(pageCursors[currentPageIndex - 1] || null, currentPageIndex - 1); }); }
function renderSearch(data, append) { const filesList = document.getElementById('filesList'); if (!filesList) return; if (!append) filesList.innerHTML = ''; let files = (data.files || []); files = files.filter(function(f){ var n = (f.filename || ''); var base = n.split('/').pop(); return !n.startsWith('__') && !base.startsWith('.'); }); function byName(a, b) { var sa = (a || '').toString(); var sb = (b || '').toString(); return sa.localeCompare(sb, undefined, { sensitivity: 'base' }); } function byDate(a, b) { var da = a && a.lastModified ? new Date(a.lastModified).getTime() : 0; var db = b && b.lastModified ? new Date(b.lastModified).getTime() : 0; return da - db; } function bySize(a, b) { var sa = a && typeof a.size === 'number' ? a.size : 0; var sb = b && typeof b.size === 'number' ? b.size : 0; return sa - sb; } files = files.slice().sort(function(a, b){ switch (currentSort) { case 'name_desc': return byName(a && a.filename ? a.filename : '', b && b.filename ? b.filename : '') * -1; case 'date_desc': return byDate(a, b) * -1; case 'date_asc': return byDate(a, b); case 'size_desc': return bySize(a, b) * -1; case 'size_asc': return bySize(a, b); default: return byName(a && a.filename ? a.filename : '', b && b.filename ? b.filename : ''); } }); var statsEl = document.getElementById('stats'); if (statsEl) statsEl.textContent = files.length + ' results'; const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); var filename = file.filename || ''; var ext = (filename.split('.').pop() || '').toLowerCase(); var canPreview = (ext === 'pdf' || ext === 'xml' || ext === 'json' || ext === 'txt'); return '<div class="file-item" data-key="' + encodedKey + '"><div class="file-name">' + file.filename + '</div><div class="file-size">' + (function(b){ if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]; })(file.size) + '</div><div class="file-date">' + new Date(file.lastModified).toLocaleString() + '</div><div class="file-actions">' + (canPreview ? '<button class="action-button" data-action="preview" data-key="' + encodedKey + '">Open</button>' : '') + '<button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button><button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button></div></div>'; }).join(''); const content = filesHtml; if (!append && content.trim() === '') { filesList.innerHTML = '<div class="no-files">No results</div>'; } else { filesList.insertAdjacentHTML('beforeend', content); } var existingPager = document.getElementById('paginationRow'); if (existingPager) existingPager.remove(); var canPrev = searchPageIndex > 0; var canNext = !!(data.truncated && data.cursor); filesList.insertAdjacentHTML('beforeend', '<div id="paginationRow" style="display:flex;justify-content:center;align-items:center;padding:12px;">' + '<div style="display:inline-flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--border);border-radius:9999px;background:var(--surface);">' + '<button id="prevPageBtn"' + (canPrev ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canPrev ? 'pointer' : 'not-allowed') + ';opacity:' + (canPrev ? '1' : '.5') + '">‹</button>' + '<span style="font-size:12px;color:var(--muted);font-weight:700;">' + (searchPageIndex + 1) + '</span>' + '<button id="nextPageBtn"' + (canNext ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canNext ? 'pointer' : 'not-allowed') + ';opacity:' + (canNext ? '1' : '.5') + '">›</button>' + '</div>' + '</div>'); var nextBtn = document.getElementById('nextPageBtn'); if (nextBtn) nextBtn.addEventListener('click', function(){ if (!searchCursor) return; loadSearch(searchPageCursors[searchPageIndex + 1] || searchCursor, searchPageIndex + 1); }); var prevBtn = document.getElementById('prevPageBtn'); if (prevBtn) prevBtn.addEventListener('click', function(){ if (searchPageIndex <= 0) return; loadSearch(searchPageCursors[searchPageIndex - 1] || null, searchPageIndex - 1); }); }
async function downloadFile(key) { try { const response = await fetch(BACKEND_URL + '/api/files/' + key, { headers: getAuthHeaders() }); await handleApiResponse(response); const expected = response.headers.get('X-Checksum-SHA256'); const blob = await response.blob(); if (expected) { const actual = await computeBlobSHA256(blob, null); if ((actual || '').toLowerCase() !== (expected || '').toLowerCase()) { throw new Error('Checksum mismatch'); } } const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = key.split('/').pop(); document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); } catch (error) { alert('Download failed: ' + error.message); } }
async function deleteFile(key) { if (!confirm('Are you sure you want to delete this file?')) return; try { const response = await fetch(BACKEND_URL + '/api/files/' + key, { method: 'DELETE', headers: getAuthHeaders() }); await handleApiResponse(response); loadFiles(); } catch (error) { alert('Delete failed: ' + error.message); } }
(function toolbar(){ var searchInput = document.getElementById('searchInput'); var sortSelect = document.getElementById('sortSelect'); var refreshBtn = document.getElementById('refreshBtn'); if (searchInput) searchInput.addEventListener('input', function(e){ var q = (e.target.value || '').toLowerCase().trim(); filterText = q; activeSearchQuery = q; if (q) { searchMode = true; searchPageCursors = [null]; searchPageIndex = 0; loadSearch(null, 0); } else { searchMode = false; searchResults = []; searchTruncated = false; searchCursor = null; renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } }); if (sortSelect) sortSelect.addEventListener('change', function(e){ currentSort = e.target.value || 'name_asc'; if (searchMode) { renderSearch({ files: searchResults, truncated: searchTruncated, cursor: searchCursor }, false); } else { renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } }); if (refreshBtn) refreshBtn.addEventListener('click', function(){ if (searchMode) { searchPageCursors = [null]; searchPageIndex = 0; loadSearch(null, 0); } else { loadFiles(); } }); })();
(function listDelegation(){ var list = document.getElementById('filesList'); if (!list) return; list.addEventListener('click', function(e){ var row = e.target && e.target.closest && e.target.closest('.file-item[data-prefix]'); if (row && row.getAttribute) { e.preventDefault(); var encoded = row.getAttribute('data-prefix'); if (encoded) navigateToPrefix(decodeURIComponent(encoded)); return; } var btn = e.target && e.target.closest && e.target.closest('button[data-action]'); if (btn && btn.getAttribute) { e.preventDefault(); var action = btn.getAttribute('data-action'); var encodedKey = btn.getAttribute('data-key') || ''; var key = encodedKey ? decodeURIComponent(encodedKey) : ''; if (action === 'preview') return openPreview(key); if (action === 'download') return downloadFile(key); if (action === 'delete') return deleteFile(key); } }); var bc = document.getElementById('breadcrumb'); if (bc) bc.addEventListener('click', function(e){ var a = e.target && e.target.closest && e.target.closest('a[data-prefix]'); if (a && a.getAttribute) { e.preventDefault(); var p = a.getAttribute('data-prefix'); if (p) navigateToPrefix(p); } }); })();
function navigateToPrefix(prefix) { setUrlPrefix(prefix); var si = document.getElementById('searchInput'); if (si) si.value = ''; filterText = ''; searchMode = false; activeSearchQuery = ''; searchResults = []; searchTruncated = false; searchCursor = null; pageCursors = [null]; currentPageIndex = 0; loadFiles(null, 0); }
`;


