const http = require('http');

function createServer(port, getDownloadsList, onAddDownload, onAction) {
  const server = http.createServer((req, res) => {
    // Enable CORS for browser extensions
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MCDM-Extension, Origin, Accept');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = parsedUrl.pathname;

    // Helper for JSON responses
    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (req.method === 'GET' && pathname === '/ping') {
      const downloads = getDownloadsList();
      const activeCount = downloads.filter(d => d.status === 'downloading').length;
      sendJson(200, {
        version: '0.0.1',
        active: activeCount,
        running: true,
        app: 'Download Manager',
        captureExtensions: [
          'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg', 'exe', 'msi', 'pkg',
          'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
          'mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg',
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
        ]
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/downloads') {
      const downloads = getDownloadsList();
      const items = downloads.map(d => ({
        id: d.id,
        name: d.file_name,
        total: d.total_size,
        received: d.downloaded_size,
        speed: d.speed,
        state: d.status
      }));
      sendJson(200, { items });
      return;
    }

    if (req.method === 'POST' && pathname === '/download') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (!data.url) {
            sendJson(400, { ok: false, error: 'URL is required' });
            return;
          }
          const item = onAddDownload({
            url: data.url,
            file_name: data.filename || '',
            referrer: data.referer || '',
            user_agent: data.userAgent || '',
            cookies: data.cookieHeader || '',
            is_video_stream: data.kind === 'video'
          });
          sendJson(200, { ok: true, id: item.id });
        } catch (e) {
          sendJson(400, { ok: false, error: e.message });
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/action') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (!data.id || !data.action) {
            sendJson(400, { ok: false, error: 'id and action are required' });
            return;
          }
          onAction(data.id, data.action);
          sendJson(200, { ok: true });
        } catch (e) {
          sendJson(400, { ok: false, error: e.message });
        }
      });
      return;
    }

    sendJson(404, { ok: false, error: 'Not found' });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Bridge Server] Port ${port} is already in use by another instance.`);
    } else {
      console.error('[Bridge Server] Error:', err);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[Bridge Server] Listening on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = { createServer };
