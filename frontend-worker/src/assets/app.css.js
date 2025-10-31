export const APP_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #0f1222;
  --bg-accent: radial-gradient(1200px 600px at 0% 0%, #3a2cf3 0%, transparent 60%), radial-gradient(900px 500px at 100% 0%, #a24bb6 0%, transparent 60%), #0f1222;
  --surface: rgba(255,255,255,0.08);
  --surface-strong: rgba(255,255,255,0.12);
  --text: #eef0ff;
  --muted: #aab0d5;
  --border: rgba(255,255,255,0.12);
  --primary: #8b5cf6;
  --primary-600: #7c3aed;
  --primary-700: #6d28d9;
  --success: #22c55e;
  --danger: #ef4444;
  --warning: #f59e0b;
}
body.light {
  --bg: #f6f7fb;
  --bg-accent: radial-gradient(1200px 600px at 0% 0%, #dfe2ff 0%, transparent 60%), radial-gradient(900px 500px at 100% 0%, #f3e4ff 0%, transparent 60%), #f6f7fb;
  --surface: #ffffff;
  --surface-strong: #ffffff;
  --text: #0f1222;
  --muted: #5b617f;
  --border: #e6e8f2;
}
html, body { height: 100%; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  background: var(--bg-accent);
  min-height: 100vh;
  padding: 32px;
  line-height: 1.45;
}
.app { max-width: 1200px; margin: 0 auto; }
.glass {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  backdrop-filter: saturate(130%) blur(12px);
  -webkit-backdrop-filter: saturate(130%) blur(12px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; margin-bottom: 24px; }
.brand { display: flex; align-items: center; gap: 12px; font-weight: 800; letter-spacing: 0.2px; }
.brand-logo { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 12px; background: linear-gradient(135deg, var(--primary), var(--primary-600)); box-shadow: 0 8px 24px rgba(139, 92, 246, 0.45); }
.top-actions { display: flex; align-items: center; gap: 10px; }
.btn { display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); color: var(--text); background: transparent; cursor: pointer; font-weight: 600; transition: transform .12s ease, background .2s ease, border-color .2s ease; }
.btn:hover { transform: translateY(-1px); border-color: var(--surface-strong); }
.btn-primary { background: linear-gradient(135deg, var(--primary), var(--primary-600)); border: none; color: white; box-shadow: 0 10px 30px rgba(139,92,246,0.35); }
.btn-primary:hover { transform: translateY(-1px) scale(1.01); }
.hero { padding: 28px 24px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; align-items: center; margin-bottom: 20px; }
.hero h1 { font-size: 34px; line-height: 1.15; margin-bottom: 8px; }
.hero p { color: var(--muted); }
.tabs { display: flex; gap: 10px; padding: 6px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 12px; width: fit-content; }
.tab { text-decoration: none; padding: 10px 14px; border-radius: 10px; font-weight: 600; color: var(--muted); transition: background .2s ease, color .2s ease; }
.tab.active { color: white; background: linear-gradient(135deg, var(--primary), var(--primary-600)); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1); }
.content { padding: 24px; display: grid; gap: 24px; }
.content.upload-mode { min-height: auto; align-content: center; }

/* Upload */
.upload-card { padding: 24px; border-radius: 16px; border: 1px dashed rgba(139,92,246,0.6); background: rgba(139,92,246,0.08); transition: transform .15s ease, background .2s ease, border-color .2s ease; cursor: pointer; text-align: center; min-height: clamp(180px, 28vh, 220px); }
.upload-card:hover { transform: scale(1.01); background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.9); }
.upload-card.dragover { transform: scale(1.015); background: rgba(139,92,246,0.16); }
.upload-icon { font-size: 48px; margin-bottom: 12px; }
.upload-text { color: var(--muted); margin-bottom: 6px; font-size: 15px; }
.file-input { display: none; }
.progress { margin-top: 18px; display: none; text-align: left; }
.progress-bar { width: 100%; height: 10px; background: rgba(255,255,255,0.12); border-radius: 999px; overflow: hidden; border: 1px solid var(--border); }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-600), var(--primary-700)); width: 0%; transition: width 0.25s ease; }
.progress-text { margin-top: 6px; color: var(--muted); font-weight: 600; }
.file-info { display: none; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.file-info h3 { margin-bottom: 6px; font-size: 15px; }
.file-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.file-detail-label { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
.file-detail-value { font-weight: 600; }
.uploads-list { display: grid; gap: 10px; }
.upload-item { padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.upload-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.upload-item-name { font-weight: 600; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upload-item-status { color: var(--muted); font-size: 13px; }

/* Messages */
.message { padding: 12px 14px; border-radius: 12px; margin-top: 10px; font-weight: 600; border: 1px solid var(--border); }
.message.success { background: rgba(34, 197, 94, 0.12); color: #22c55e; border-color: rgba(34, 197, 94, 0.35); }
.message.error { background: rgba(239, 68, 68, 0.12); color: #ef4444; border-color: rgba(239, 68, 68, 0.35); }
.message.info { background: rgba(147, 197, 253, 0.12); color: #60a5fa; border-color: rgba(147, 197, 253, 0.35); }

/* Files */
.files-container { display: grid; gap: 14px; }
.files-header { display: flex; align-items: center; justify-content: space-between; }
.breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); }
.breadcrumb a { color: var(--primary); text-decoration: none; font-weight: 600; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb-sep { opacity: 0.6; }
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
.input, .select { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
.input { min-width: 220px; flex: 1; }
.select { min-width: 160px; }
.stats { color: var(--muted); font-size: 13px; }
.list-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; padding: 10px 14px; font-weight: 700; color: var(--muted); background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 12px; position: sticky; top: 0; z-index: 5; }
.files-list { background: transparent; border-radius: 12px; overflow: hidden; }
.file-item { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; align-items: center; background: var(--surface); margin-bottom: 10px; transition: transform .12s ease, background .2s ease; }
.file-item:hover { transform: translateY(-1px); background: var(--surface-strong); }
.file-name { font-weight: 600; }
.file-size, .file-date { color: var(--muted); }
.file-actions { display: flex; gap: 8px; }
.action-button { padding: 8px 10px; border-radius: 10px; font-weight: 700; font-size: 12px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; }
.download-button { border-color: rgba(59,130,246,0.5); color: #93c5fd; }
.delete-button { border-color: rgba(239,68,68,0.5); color: #fca5a5; }
.loading, .no-files { text-align: center; padding: 24px; color: var(--muted); }

/* Modal viewer */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: grid; place-items: center; z-index: 1000; }
.modal-dialog { width: min(100%, 960px); max-height: min(90vh, 100%); background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.45); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); background: var(--surface-strong); }
.modal-title { font-weight: 700; }
.modal-actions { display: flex; gap: 8px; }
.modal-body { padding: 0; height: 70vh; background: var(--surface); }
.viewer-iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.viewer-pre { width: 100%; height: 100%; margin: 0; padding: 14px; overflow: auto; white-space: pre-wrap; word-wrap: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #0b0f1a; color: #e6e8f1; }
`;


