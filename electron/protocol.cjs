// Protocol schemes for deep-linking and browser extension app launching
const path = require('path');

const PROTOCOL_NAMES = ['indirmeyoneticisi', 'tarus-dm'];

function parseProtocolUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    const scheme = parsed.protocol.replace(/:$/, '');
    if (!PROTOCOL_NAMES.includes(scheme)) return null;

    // Action can be hostname (indirmeyoneticisi://download?...) or pathname (indirmeyoneticisi:///download?...)
    const action = parsed.hostname || parsed.pathname.replace(/^\/+/, '');

    if (action === 'download') {
      const url = parsed.searchParams.get('url');
      if (!url) return { action: 'open' };
      return {
        action: 'download',
        url,
        fileName: parsed.searchParams.get('filename') || parsed.searchParams.get('fileName') || '',
        referer: parsed.searchParams.get('referer') || parsed.searchParams.get('referrer') || '',
        userAgent: parsed.searchParams.get('userAgent') || parsed.searchParams.get('user_agent') || '',
        cookies: parsed.searchParams.get('cookies') || '',
        kind: parsed.searchParams.get('kind') || (parsed.searchParams.get('isVideo') === 'true' ? 'video' : 'file')
      };
    }

    return { action: 'open' };
  } catch {
    return null;
  }
}

function registerProtocolClients(app, basePath) {
  if (!app || typeof app.setAsDefaultProtocolClient !== 'function') return;
  const targetPath = basePath || (process.argv[1] ? path.resolve(process.argv[1]) : '');

  for (const proto of PROTOCOL_NAMES) {
    try {
      if (process.defaultApp && targetPath) {
        app.setAsDefaultProtocolClient(proto, process.execPath, [targetPath]);
      } else if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE) {
        // Windows portable: execPath is a temp extraction dir deleted on exit; register the real .exe
        app.setAsDefaultProtocolClient(proto, process.env.PORTABLE_EXECUTABLE_FILE, []);
      } else {
        app.setAsDefaultProtocolClient(proto);
      }
    } catch (e) {
      console.warn(`[Protocol] Failed to register ${proto}:`, e);
    }
  }
}

module.exports = {
  PROTOCOL_NAMES,
  parseProtocolUrl,
  registerProtocolClients
};
