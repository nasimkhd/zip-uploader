export const APP_JS = `
// Config
const BACKEND_URL = (window.__CONFIG__ && window.__CONFIG__.BACKEND_URL) || '';

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

// Minimal incremental SHA-256 implementation and helpers
function createSHA256() {
    const K = new Uint32Array([
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function toHex32(x) { return ('00000000' + x.toString(16)).slice(-8); }
    const w = new Uint32Array(64);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const buffer = new Uint8Array(64);
    let bufferLength = 0;
    let bytesHashed = 0;
    let finished = false;
    function processChunk(chunk) {
        for (let i = 0; i < 16; i++) {
            w[i] = (chunk[i*4] << 24) | (chunk[i*4 + 1] << 16) | (chunk[i*4 + 2] << 8) | (chunk[i*4 + 3]);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = (rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3)) >>> 0;
            const s1 = (rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10)) >>> 0;
            w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
            const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const temp2 = (S0 + maj) >>> 0;
            h = g; g = f; f = e; e = (d + temp1) >>> 0;
            d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
        h5 = (h5 + f) >>> 0;
        h6 = (h6 + g) >>> 0;
        h7 = (h7 + h) >>> 0;
    }
    return {
        update(data) {
            if (finished) throw new Error('SHA-256: cannot update because hash was finished.');
            if (data instanceof ArrayBuffer) data = new Uint8Array(data);
            let pos = 0;
            const len = data.length >>> 0;
            bytesHashed += len;
            // Fill buffer then process
            while (pos < len) {
                const take = Math.min(64 - bufferLength, len - pos);
                for (let i = 0; i < take; i++) buffer[bufferLength + i] = data[pos + i];
                bufferLength += take;
                pos += take;
                if (bufferLength === 64) {
                    processChunk(buffer);
                    bufferLength = 0;
                }
            }
            return this;
        },
        digestHex() {
            if (!finished) {
                finished = true;
                // Pad
                const bitsHashed = bytesHashed * 8;
                buffer[bufferLength++] = 0x80;
                if (bufferLength > 56) {
                    while (bufferLength < 64) buffer[bufferLength++] = 0;
                    processChunk(buffer);
                    bufferLength = 0;
                }
                while (bufferLength < 56) buffer[bufferLength++] = 0;
                // Append length (big-endian 64-bit)
                for (let i = 7; i >= 0; i--) {
                    buffer[bufferLength++] = (bitsHashed >>> (i * 8)) & 0xff;
                }
                processChunk(buffer);
            }
            return (
                toHex32(h0) + toHex32(h1) + toHex32(h2) + toHex32(h3) +
                toHex32(h4) + toHex32(h5) + toHex32(h6) + toHex32(h7)
            );
        }
    };
}

async function computeBlobSHA256(blob, onProgress, chunkSize) {
    const size = blob.size;
    const step = chunkSize || (8 * 1024 * 1024);
    const hasher = createSHA256();
    let offset = 0;
    while (offset < size) {
        const end = Math.min(offset + step, size);
        const chunk = blob.slice(offset, end);
        const ab = await chunk.arrayBuffer();
        hasher.update(new Uint8Array(ab));
        offset = end;
        if (onProgress) {
            const p = Math.floor((offset / size) * 100);
            try { onProgress(p); } catch {}
        }
    }
    return hasher.digestHex();
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
            // 1) Compute checksum first (use larger chunk size for speed)
            let lastHashProgress = 0;
            const sha256 = await computeFileSHA256(
                file,
                function(p){
                    lastHashProgress = p;
                    if (onProgress) {
                        try { onProgress({ phase: 'hash', percent: p }); } catch {}
                    }
                },
                32 * 1024 * 1024 // 32MB chunks for hashing
            );
            // 2) Upload with checksum
            if (file.size < 100 * 1024 * 1024) return await this.simpleUpload(file, fileId, onProgress, sha256);
            return await this.multipartUpload(file, fileId, onProgress, sha256);
        } catch (e) { console.error('Upload failed:', e); throw e; }
    }
    async simpleUpload(file, fileId, onProgress, sha256) {
        const fd = new FormData(); fd.append('file', file); if (sha256) fd.append('sha256', sha256);
        const res = await fetch(this.backendUrl + '/api/upload', { method: 'POST', body: fd });
        if (!res.ok) { let m = 'Upload failed'; try { const err = await res.json(); m = err.error || m; } catch {} throw new Error(m); }
        onProgress && onProgress(100); return await res.json();
    }
    async multipartUpload(file, fileId, onProgress, sha256) {
        const init = await fetch(this.backendUrl + '/api/upload/multipart/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || 'application/zip', sha256: sha256 }) });
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
function showMessage(text, type) { var m = document.getElementById('message'); if (m) m.innerHTML = '<div class="message ' + type + '">' + text + '</div>'; }
        
// Files logic
const PAGE_SIZE = 6; let currentPrefix = null; let currentCursor = null; let cachedFolders = []; let cachedFiles = []; let cachedTruncated = false; let cachedCursor = null; let currentSort = 'name_asc'; let filterText = ''; let pageCursors = [null]; let currentPageIndex = 0;
// Global search state
let searchMode = false; let searchResults = []; let searchTruncated = false; let searchCursor = null; let searchPageCursors = [null]; let searchPageIndex = 0; let activeSearchQuery = '';
function normalizePrefix(p) { let v = (p || 'unzipped/'); try { v = decodeURIComponent(v); } catch {} if (!v.startsWith('unzipped/')) v = 'unzipped/'; if (!v.endsWith('/')) v = v + '/'; return v; }
function getPrefixFromUrl() { const params = new URLSearchParams(location.search); return normalizePrefix(params.get('prefix') || 'unzipped/'); }
function setUrlPrefix(prefix) { const url = new URL(location.href); url.pathname = '/files'; url.searchParams.set('prefix', prefix); history.pushState({ prefix }, '', url); }
function getFolderName(prefix) { const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix; const parts = trimmed.split('/'); return (parts[parts.length - 1] || '') + '/'; }
function buildBreadcrumb(prefix) { const bc = document.getElementById('breadcrumb'); if (!bc) return; const parts = prefix.split('/').filter(Boolean); let acc = ''; const segs = parts.map(function(name){ acc += name + '/'; return { name: name + '/', prefix: acc }; }); bc.innerHTML = segs.map(function(seg, idx){ var isLast = idx === segs.length - 1; var link = isLast ? '<span>' + seg.name + '</span>' : '<a href="#" data-prefix="' + seg.prefix + '">' + seg.name + '</a>'; return idx === 0 ? link : '<span class="breadcrumb-sep">›</span>' + link; }).join(' '); }
async function loadFiles(cursor, pageIndex) { try { const prefix = getPrefixFromUrl(); if (typeof cursor === 'undefined') cursor = pageCursors[currentPageIndex] || null; if (typeof pageIndex !== 'number') pageIndex = currentPageIndex; const firstPage = currentPrefix !== prefix && !cursor; if (firstPage) document.getElementById('filesList').innerHTML = '<div class="loading">Loading files...</div>'; if (currentPrefix !== prefix) { currentPrefix = prefix; currentCursor = null; } const qs = new URLSearchParams({ prefix: currentPrefix }); if (cursor) qs.set('cursor', cursor); qs.set('limit', String(PAGE_SIZE)); const response = await fetch(BACKEND_URL + '/api/files?' + qs.toString()); if (!response.ok) throw new Error('Failed to load files'); const data = await response.json(); cachedFolders = data.folders || []; cachedFiles = data.files || []; cachedTruncated = !!data.truncated; cachedCursor = data.truncated ? data.cursor : null; currentCursor = cachedCursor; currentPageIndex = pageIndex; pageCursors[pageIndex] = cursor || null; pageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null; buildBreadcrumb(currentPrefix); renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } catch (error) { document.getElementById('filesList').innerHTML = '<div class="loading">Error loading files: ' + error.message + '</div>'; } }
async function loadSearch(cursor, pageIndex) { try { const q = (activeSearchQuery || '').trim(); const prefix = getPrefixFromUrl(); if (!q) { searchMode = false; renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); return; } if (typeof cursor === 'undefined') cursor = searchPageCursors[searchPageIndex] || null; if (typeof pageIndex !== 'number') pageIndex = searchPageIndex; const firstPage = (searchPageIndex !== pageIndex) || (!cursor && searchCursor === null); if (firstPage) document.getElementById('filesList').innerHTML = '<div class="loading">Searching...</div>'; const qs = new URLSearchParams({ prefix: prefix, q: q }); if (cursor) qs.set('cursor', cursor); qs.set('limit', String(PAGE_SIZE)); const response = await fetch(BACKEND_URL + '/api/search?' + qs.toString()); if (!response.ok) throw new Error('Search failed'); const data = await response.json(); searchResults = data.files || []; searchTruncated = !!data.truncated; searchCursor = data.truncated ? data.cursor : null; searchPageIndex = pageIndex; searchPageCursors[pageIndex] = cursor || null; searchPageCursors[pageIndex + 1] = data.truncated ? (data.cursor || null) : null; buildBreadcrumb(prefix); renderSearch({ files: searchResults, truncated: searchTruncated, cursor: searchCursor }, false); } catch (error) { document.getElementById('filesList').innerHTML = '<div class="loading">Search error: ' + error.message + '</div>'; } }
function renderListing(data, append) { const filesList = document.getElementById('filesList'); if (!filesList) return; if (!append) filesList.innerHTML = ''; let folders = (data.folders || []); let files = (data.files || []); folders = folders.filter(function(f){ var name = getFolderName(f); return !name.startsWith('__'); }); files = files.filter(function(f){ var n = (f.filename || ''); var base = n.split('/').pop(); return !n.startsWith('__') && !base.startsWith('.'); }); if (filterText) { var q = filterText; folders = folders.filter(function(f){ return getFolderName(f).toLowerCase().indexOf(q) !== -1; }); files = files.filter(function(f){ return (f.filename || '').toLowerCase().indexOf(q) !== -1; }); } function byName(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); } function byDate(a, b) { return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(); } function bySize(a, b) { return a.size - b.size; } folders = folders.slice().sort(function(a, b){ var an = getFolderName(a); var bn = getFolderName(b); if (currentSort === 'name_desc') return byName(bn, an); return byName(an, bn); }); files = files.slice().sort(function(a, b){ switch (currentSort) { case 'name_desc': return byName(a.filename, b.filename) * -1; case 'date_desc': return byDate(a, b) * -1; case 'date_asc': return byDate(a, b); case 'size_desc': return bySize(a, b) * -1; case 'size_asc': return bySize(a, b); default: return byName(a.filename, b.filename); } }); var statsEl = document.getElementById('stats'); if (statsEl) statsEl.textContent = folders.length + ' folders · ' + files.length + ' files'; const foldersHtml = folders.map(function(folder){ return '<div class="file-item" data-prefix="' + encodeURIComponent(folder) + '"><div class="file-name">📁 ' + getFolderName(folder) + '</div><div class="file-size">-</div><div class="file-date">-</div><div class="file-actions"></div></div>'; }).join(''); const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); return '<div class="file-item" data-key="' + encodedKey + '"><div class="file-name">' + file.filename + '</div><div class="file-size">' + (function(b){ if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]; })(file.size) + '</div><div class="file-date">' + new Date(file.lastModified).toLocaleString() + '</div><div class="file-actions"><button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button><button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button></div></div>'; }).join(''); const content = foldersHtml + filesHtml; if (!append && content.trim() === '') { filesList.innerHTML = '<div class="no-files">Empty folder</div>'; } else { filesList.insertAdjacentHTML('beforeend', content); } var existingPager = document.getElementById('paginationRow'); if (existingPager) existingPager.remove(); var canPrev = currentPageIndex > 0; var canNext = !!(data.truncated && data.cursor); filesList.insertAdjacentHTML('beforeend', '<div id="paginationRow" style="display:flex;justify-content:center;align-items:center;padding:12px;">' + '<div style="display:inline-flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--border);border-radius:9999px;background:var(--surface);">' + '<button id="prevPageBtn"' + (canPrev ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canPrev ? 'pointer' : 'not-allowed') + ';opacity:' + (canPrev ? '1' : '.5') + '">‹</button>' + '<span style="font-size:12px;color:var(--muted);font-weight:700;">' + (currentPageIndex + 1) + '</span>' + '<button id="nextPageBtn"' + (canNext ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canNext ? 'pointer' : 'not-allowed') + ';opacity:' + (canNext ? '1' : '.5') + '">›</button>' + '</div>' + '</div>'); var nextBtn = document.getElementById('nextPageBtn'); if (nextBtn) nextBtn.addEventListener('click', function(){ if (!cachedCursor) return; loadFiles(pageCursors[currentPageIndex + 1] || cachedCursor, currentPageIndex + 1); }); var prevBtn = document.getElementById('prevPageBtn'); if (prevBtn) prevBtn.addEventListener('click', function(){ if (currentPageIndex <= 0) return; loadFiles(pageCursors[currentPageIndex - 1] || null, currentPageIndex - 1); }); }
function renderSearch(data, append) { const filesList = document.getElementById('filesList'); if (!filesList) return; if (!append) filesList.innerHTML = ''; let files = (data.files || []); files = files.filter(function(f){ var n = (f.filename || ''); var base = n.split('/').pop(); return !n.startsWith('__') && !base.startsWith('.'); }); function byName(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); } function byDate(a, b) { return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(); } function bySize(a, b) { return a.size - b.size; } files = files.slice().sort(function(a, b){ switch (currentSort) { case 'name_desc': return byName(a.filename, b.filename) * -1; case 'date_desc': return byDate(a, b) * -1; case 'date_asc': return byDate(a, b); case 'size_desc': return bySize(a, b) * -1; case 'size_asc': return bySize(a, b); default: return byName(a.filename, b.filename); } }); var statsEl = document.getElementById('stats'); if (statsEl) statsEl.textContent = files.length + ' results'; const filesHtml = files.map(function(file){ var encodedKey = encodeURIComponent(file.key); return '<div class="file-item" data-key="' + encodedKey + '"><div class="file-name">' + file.filename + '</div><div class="file-size">' + (function(b){ if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]; })(file.size) + '</div><div class="file-date">' + new Date(file.lastModified).toLocaleString() + '</div><div class="file-actions"><button class="action-button download-button" data-action="download" data-key="' + encodedKey + '">Download</button><button class="action-button delete-button" data-action="delete" data-key="' + encodedKey + '">Delete</button></div></div>'; }).join(''); const content = filesHtml; if (!append && content.trim() === '') { filesList.innerHTML = '<div class="no-files">No results</div>'; } else { filesList.insertAdjacentHTML('beforeend', content); } var existingPager = document.getElementById('paginationRow'); if (existingPager) existingPager.remove(); var canPrev = searchPageIndex > 0; var canNext = !!(data.truncated && data.cursor); filesList.insertAdjacentHTML('beforeend', '<div id="paginationRow" style="display:flex;justify-content:center;align-items:center;padding:12px;">' + '<div style="display:inline-flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--border);border-radius:9999px;background:var(--surface);">' + '<button id="prevPageBtn"' + (canPrev ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canPrev ? 'pointer' : 'not-allowed') + ';opacity:' + (canPrev ? '1' : '.5') + '">‹</button>' + '<span style="font-size:12px;color:var(--muted);font-weight:700;">' + (searchPageIndex + 1) + '</span>' + '<button id="nextPageBtn"' + (canNext ? '' : ' disabled') + ' style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:8px;cursor:' + (canNext ? 'pointer' : 'not-allowed') + ';opacity:' + (canNext ? '1' : '.5') + '">›</button>' + '</div>' + '</div>'); var nextBtn = document.getElementById('nextPageBtn'); if (nextBtn) nextBtn.addEventListener('click', function(){ if (!searchCursor) return; loadSearch(searchPageCursors[searchPageIndex + 1] || searchCursor, searchPageIndex + 1); }); var prevBtn = document.getElementById('prevPageBtn'); if (prevBtn) prevBtn.addEventListener('click', function(){ if (searchPageIndex <= 0) return; loadSearch(searchPageCursors[searchPageIndex - 1] || null, searchPageIndex - 1); }); }
async function downloadFile(key) { try { const response = await fetch(BACKEND_URL + '/api/files/' + key); if (!response.ok) throw new Error('Failed to download file'); const expected = response.headers.get('X-Checksum-SHA256'); const blob = await response.blob(); if (expected) { const actual = await computeBlobSHA256(blob, null); if ((actual || '').toLowerCase() !== (expected || '').toLowerCase()) { throw new Error('Checksum mismatch'); } } const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = key.split('/').pop(); document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); } catch (error) { alert('Download failed: ' + error.message); } }
async function deleteFile(key) { if (!confirm('Are you sure you want to delete this file?')) return; try { const response = await fetch(BACKEND_URL + '/api/files/' + key, { method: 'DELETE' }); if (!response.ok) throw new Error('Failed to delete file'); loadFiles(); } catch (error) { alert('Delete failed: ' + error.message); } }
(function toolbar(){ var searchInput = document.getElementById('searchInput'); var sortSelect = document.getElementById('sortSelect'); var refreshBtn = document.getElementById('refreshBtn'); if (searchInput) searchInput.addEventListener('input', function(e){ var q = (e.target.value || '').toLowerCase().trim(); filterText = q; activeSearchQuery = q; if (q) { searchMode = true; searchPageCursors = [null]; searchPageIndex = 0; loadSearch(null, 0); } else { searchMode = false; searchResults = []; searchTruncated = false; searchCursor = null; renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } }); if (sortSelect) sortSelect.addEventListener('change', function(e){ currentSort = e.target.value || 'name_asc'; if (searchMode) { renderSearch({ files: searchResults, truncated: searchTruncated, cursor: searchCursor }, false); } else { renderListing({ folders: cachedFolders, files: cachedFiles, truncated: cachedTruncated, cursor: cachedCursor }, false); } }); if (refreshBtn) refreshBtn.addEventListener('click', function(){ if (searchMode) { searchPageCursors = [null]; searchPageIndex = 0; loadSearch(null, 0); } else { loadFiles(); } }); })();
(function listDelegation(){ var list = document.getElementById('filesList'); if (!list) return; list.addEventListener('click', function(e){ var row = e.target && e.target.closest && e.target.closest('.file-item[data-prefix]'); if (row && row.getAttribute) { e.preventDefault(); var encoded = row.getAttribute('data-prefix'); if (encoded) navigateToPrefix(decodeURIComponent(encoded)); return; } var btn = e.target && e.target.closest && e.target.closest('button[data-action]'); if (btn && btn.getAttribute) { e.preventDefault(); var action = btn.getAttribute('data-action'); var encodedKey = btn.getAttribute('data-key') || ''; var key = encodedKey ? decodeURIComponent(encodedKey) : ''; if (action === 'download') return downloadFile(key); if (action === 'delete') return deleteFile(key); } }); var bc = document.getElementById('breadcrumb'); if (bc) bc.addEventListener('click', function(e){ var a = e.target && e.target.closest && e.target.closest('a[data-prefix]'); if (a && a.getAttribute) { e.preventDefault(); var p = a.getAttribute('data-prefix'); if (p) navigateToPrefix(p); } }); })();
function navigateToPrefix(prefix) { setUrlPrefix(prefix); var si = document.getElementById('searchInput'); if (si) si.value = ''; filterText = ''; searchMode = false; activeSearchQuery = ''; searchResults = []; searchTruncated = false; searchCursor = null; pageCursors = [null]; currentPageIndex = 0; loadFiles(null, 0); }
`;


