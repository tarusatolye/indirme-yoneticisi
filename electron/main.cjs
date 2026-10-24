const { app, BrowserWindow, ipcMain, shell, Menu, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { SegmentedDownloader } = require('./downloader.cjs');
const { createServer, getExtensionStatus } = require('./server.cjs');
const { PROTOCOL_NAMES, parseProtocolUrl, registerProtocolClients } = require('./protocol.cjs');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Register custom protocol schemes (indirmeyoneticisi:// and tarus-dm://)
registerProtocolClients(app, path.join(__dirname, 'main.cjs'));

// Data storage paths
const userDataPath = app.getPath('userData');
const downloadsJsonPath = path.join(userDataPath, 'downloads.json');
const settingsJsonPath = path.join(userDataPath, 'settings.json');

// Default settings
let settings = {
  download_dir: app.getPath('downloads'),
  segment_count: 8,
  max_concurrent: 3,
  port: 48213,
  ytdlp_path: 'yt-dlp',
  language: 'tr'
};

if (fs.existsSync(settingsJsonPath)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(settingsJsonPath, 'utf8'));
    settings = { ...settings, ...loaded };
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
} else {
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(settingsJsonPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {}
}

// Download items
let downloads = [];
if (fs.existsSync(downloadsJsonPath)) {
  try {
    downloads = JSON.parse(fs.readFileSync(downloadsJsonPath, 'utf8'));
    // Reset any interrupted "downloading" items to "paused"
    downloads.forEach(d => {
      if (d.status === 'downloading') {
        d.status = 'paused';
        d.speed = 0;
      }
    });
  } catch (e) {
    console.error('Failed to load downloads:', e);
  }
}

function saveDownloads() {
  try {
    fs.writeFileSync(downloadsJsonPath, JSON.stringify(downloads, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save downloads:', e);
  }
}

function saveSettingsFile() {
  try {
    fs.writeFileSync(settingsJsonPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function detectCategory(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'epub'];
  const musicExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];
  const softwareExts = ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'appimage'];

  if (videoExts.includes(ext)) return 'video';
  if (docExts.includes(ext)) return 'document';
  if (musicExts.includes(ext)) return 'music';
  if (archiveExts.includes(ext)) return 'archive';
  if (softwareExts.includes(ext)) return 'software';
  return 'general';
}

function getFileNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const name = path.basename(pathname);
    if (name && name.includes('.')) return decodeURIComponent(name);
  } catch (e) {}
  return 'download_' + Date.now();
}

let mainWindow = null;

function emitTauriEvent(event, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tauri-event', { event, payload });
  }
}

function sanitizeFileName(name) {
  if (!name) return 'download_' + Date.now();
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

// Downloader instance
const downloader = new SegmentedDownloader(
  // onProgress
  (id, progress) => {
    if (typeof id === 'object' && id !== null && !progress) {
      progress = id;
      id = progress.id;
    }
    const item = downloads.find(d => d.id === id);
    if (!item) return;

    // Ignore buffered or late progress if download has been paused, canceled, or completed
    if (item.status === 'paused' || item.state === 'paused' ||
        item.status === 'canceled' || item.state === 'canceled' ||
        item.status === 'completed' || item.state === 'completed') {
      return;
    }

    if (progress.fileName || progress.file_name) {
      const newName = progress.fileName || progress.file_name;
      item.fileName = newName;
      item.file_name = newName;
    }

    const downloaded = progress.downloaded || 0;
    const total = progress.total || item.totalBytes || item.total_size || 0;
    item.receivedBytes = downloaded;
    item.downloaded_size = downloaded;
    item.totalBytes = total;
    item.total_size = total;
    item.speed = progress.speed || 0;
    item.segments = progress.segments || [];
    item.state = 'downloading';
    item.status = 'downloading';
    emitTauriEvent('download_updated', item);
  },
  // onComplete
  (id) => {
    const item = downloads.find(d => d.id === id);
    if (!item) return;
    if (item.status === 'paused' || item.state === 'paused' ||
        item.status === 'canceled' || item.state === 'canceled') {
      return;
    }
    item.state = 'completed';
    item.status = 'completed';
    item.speed = 0;
    saveDownloads();
    emitTauriEvent('download_updated', item);
  },
  // onError
  (id, err) => {
    const item = downloads.find(d => d.id === id);
    if (!item) return;
    if (item.status === 'paused' || item.state === 'paused' ||
        item.status === 'canceled' || item.state === 'canceled') {
      return;
    }
    item.state = 'failed';
    item.status = 'failed';
    item.errorMessage = err;
    item.error_message = err;
    item.speed = 0;
    saveDownloads();
    emitTauriEvent('download_updated', item);
  }
);

function addDownloadInternal(payload) {
  const url = payload.url.trim();
  const isVideo = payload.isVideo || payload.is_video_stream || /youtube\.com|youtu\.be|vimeo\.com|twitter\.com|x\.com|tiktok\.com|instagram\.com/i.test(url);
  let fileName = (payload.fileName || payload.file_name)?.trim();
  if (!fileName || fileName === 'YouTube' || fileName === 'Video' || fileName.toLowerCase() === 'x') {
    fileName = isVideo ? 'Video İndiriliyor...' : getFileNameFromUrl(url);
  }
  fileName = sanitizeFileName(fileName);

  const category = isVideo ? 'video' : detectCategory(fileName);
  const savePath = payload.savePath || payload.save_path || path.join(settings.download_dir, fileName);

  const item = {
    id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    url,
    fileName: fileName,
    file_name: fileName,
    savePath: savePath,
    save_path: savePath,
    category: category,
    kind: isVideo ? 'video' : 'file',
    state: 'downloading',
    status: 'downloading',
    totalBytes: 0,
    total_size: 0,
    receivedBytes: 0,
    downloaded_size: 0,
    speed: 0,
    supportsRanges: true,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    segments: [],
    is_video_stream: isVideo,
    user_agent: payload.userAgent || payload.user_agent || '',
    referrer: payload.referrer || payload.referer || '',
    cookies: payload.cookies || '',
    errorMessage: null,
    error_message: null
  };

  downloads.unshift(item);
  saveDownloads();
  emitTauriEvent('download_added', item);

  // Bring window to front when a download starts
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  // Start downloading
  downloader.start(item, settings.segment_count || 8);
  return item;
}

// Extension directory helper — ensures extension files exist in writable userData
function prepareExtensionDirectory() {
  const targetDir = path.join(userDataPath, 'extension');
  const sourceCandidates = [
    path.join(process.resourcesPath, 'Extension'),
    path.join(__dirname, '..', 'Extension')
  ];

  let sourceDir = null;
  for (const candidate of sourceCandidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'manifest.json'))) {
      sourceDir = candidate;
      break;
    }
  }

  if (sourceDir) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.cpSync(sourceDir, targetDir, { recursive: true });
    } catch (err) {
      console.error('Failed to copy extension files:', err);
    }
  }

  return targetDir;
}

function launchBrowserExtensionPage(targetBrowser, url) {
  if (process.platform === 'win32') {
    const browserExecutables = {
      chrome: 'chrome',
      edge: 'msedge',
      brave: 'brave',
      firefox: 'firefox',
      opera: 'opera'
    };

    const exe = browserExecutables[targetBrowser] || 'chrome';
    exec(`start ${exe} "${url}"`, (err) => {
      if (err) {
        shell.openExternal(url).catch(() => {});
      }
    });
  } else if (process.platform === 'darwin') {
    const macAppNames = {
      chrome: 'Google Chrome',
      edge: 'Microsoft Edge',
      brave: 'Brave Browser',
      firefox: 'Firefox',
      opera: 'Opera'
    };
    const appName = macAppNames[targetBrowser] || 'Google Chrome';
    exec(`open -a "${appName}" "${url}"`, (err) => {
      if (err) {
        shell.openExternal(url).catch(() => {});
      }
    });
  } else {
    shell.openExternal(url).catch(() => {});
  }
}

// Start browser extension bridge server
createServer(
  settings.port || 48213,
  () => downloads,
  (req) => addDownloadInternal(req),
  (id, action) => {
    const item = downloads.find(d => d.id === id);
    if (!item) return;
    if (action === 'pause') {
      downloader.pause(id);
      item.status = 'paused';
      item.speed = 0;
      saveDownloads();
      emitTauriEvent('download_updated', item);
    } else if (action === 'resume') {
      item.status = 'downloading';
      emitTauriEvent('download_updated', item);
      downloader.start(item, settings.segment_count || 8);
    } else if (action === 'cancel') {
      downloader.pause(id);
      item.status = 'failed';
      item.speed = 0;
      saveDownloads();
      emitTauriEvent('download_updated', item);
    } else if (action === 'delete') {
      downloader.pause(id);
      downloads = downloads.filter(d => d.id !== id);
      saveDownloads();
      emitTauriEvent('download_deleted', id);
    }
  },
  (status) => {
    emitTauriEvent('extension_status', status);
  }
);

// Register IPC handlers for Tauri invokes
ipcMain.handle('tauri-invoke', async (_e, cmd, args) => {
  switch (cmd) {
    case 'get_downloads':
      return downloads;

    case 'get_settings':
      return settings;

    case 'save_settings': {
      const newSettings = args.newSettings || args.settings || {};
      settings = { ...settings, ...newSettings };
      saveSettingsFile();
      return settings;
    }

    case 'add_download': {
      const payload = args.payload;
      return addDownloadInternal(payload);
    }

    case 'pause_download': {
      const id = args.id;
      const item = downloads.find(d => d.id === id);
      if (item) {
        item.status = 'paused';
        item.state = 'paused';
        item.speed = 0;
        if (Array.isArray(item.segments)) {
          item.segments.forEach(seg => { seg.active = false; });
        }
        saveDownloads();
        emitTauriEvent('download_updated', item);
      }
      downloader.pause(id);
      return null;
    }

    case 'resume_download': {
      const id = args.id;
      const item = downloads.find(d => d.id === id);
      if (item) {
        item.status = 'downloading';
        item.state = 'downloading';
        item.errorMessage = null;
        item.error_message = null;
        saveDownloads();
        emitTauriEvent('download_updated', item);
        downloader.start(item, settings.segment_count || 8);
      }
      return null;
    }

    case 'cancel_download': {
      const id = args.id;
      const item = downloads.find(d => d.id === id);
      if (item) {
        item.status = 'cancelled';
        item.state = 'cancelled';
        item.speed = 0;
        if (Array.isArray(item.segments)) {
          item.segments.forEach(seg => { seg.active = false; });
        }
        saveDownloads();
        emitTauriEvent('download_updated', item);
      }
      downloader.pause(id);
      return null;
    }

    case 'delete_download': {
      const { id, deleteFile } = args;
      downloader.pause(id);
      const item = downloads.find(d => d.id === id);
      if (item && deleteFile) {
        const filePath = item.save_path || item.savePath;
        if (filePath && fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
        if (filePath && fs.existsSync(filePath + '.part')) {
          try { fs.unlinkSync(filePath + '.part'); } catch (e) {}
        }
        if (filePath && fs.existsSync(filePath + '.ytdl')) {
          try { fs.unlinkSync(filePath + '.ytdl'); } catch (e) {}
        }
      }
      downloads = downloads.filter(d => d.id !== id);
      saveDownloads();
      emitTauriEvent('download_deleted', id);
      return null;
    }

    case 'open_folder': {
      const p = args.path;
      if (p) {
        if (fs.existsSync(p)) {
          shell.showItemInFolder(p);
        } else {
          shell.openPath(path.dirname(p));
        }
      }
      return null;
    }

    case 'open_file': {
      const p = args.path;
      if (p && fs.existsSync(p)) {
        shell.openPath(p);
      }
      return null;
    }

    case 'check_for_updates': {
      if (!app.isPackaged) {
        return { status: 'dev_mode', message: 'Geliştirici modunda güncelleme denetlenemez.' };
      }
      try {
        const res = await autoUpdater.checkForUpdates();
        return { status: 'checked', updateInfo: res ? res.updateInfo : null };
      } catch (err) {
        return { status: 'error', error: err ? err.message : String(err) };
      }
    }

    case 'restart_and_update': {
      autoUpdater.quitAndInstall();
      return null;
    }

    case 'get_extension_info': {
      const extPath = prepareExtensionDirectory();
      const status = getExtensionStatus();
      return {
        path: extPath,
        exists: fs.existsSync(extPath),
        isConnected: status.isConnected,
        lastPing: status.lastPing,
        browser: status.browser,
        port: settings.port || 48213
      };
    }

    case 'open_extension_folder': {
      const extPath = prepareExtensionDirectory();
      if (fs.existsSync(extPath)) {
        shell.openPath(extPath);
      }
      return true;
    }

    case 'copy_extension_path': {
      const extPath = prepareExtensionDirectory();
      clipboard.writeText(extPath);
      return true;
    }

    case 'open_browser_extensions_page': {
      const targetBrowser = (args?.browser || 'chrome').toLowerCase();
      const extPath = prepareExtensionDirectory();
      clipboard.writeText(extPath);

      let url = 'chrome://extensions';
      if (targetBrowser === 'edge') {
        url = 'edge://extensions';
      } else if (targetBrowser === 'brave') {
        url = 'brave://extensions';
      } else if (targetBrowser === 'firefox') {
        url = 'about:debugging#/runtime/this-firefox';
      } else if (targetBrowser === 'opera') {
        url = 'opera://extensions';
      }

      launchBrowserExtensionPage(targetBrowser, url);
      if (args?.openFolder !== false && fs.existsSync(extPath)) {
        shell.openPath(extPath);
      }
      return true;
    }

    default:
      console.warn('Unhandled tauri command:', cmd, args);
      return null;
  }
});

function createWindow() {
  Menu.setApplicationMenu(null); // Remove default File/Edit menu

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 480,
    title: 'İndirme Yöneticisi',
    icon: path.join(__dirname, '..', 'docs', 'icon.png'),
    backgroundColor: '#1e2124',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function handleProtocolUrl(rawUrl) {
  const parsed = parseProtocolUrl(rawUrl);
  if (!parsed) return;

  if (parsed.action === 'download' && parsed.url) {
    addDownloadInternal({
      url: parsed.url,
      fileName: parsed.fileName,
      file_name: parsed.fileName,
      referrer: parsed.referer,
      referer: parsed.referer,
      userAgent: parsed.userAgent,
      user_agent: parsed.userAgent,
      cookies: parsed.cookies,
      isVideo: parsed.kind === 'video',
      is_video_stream: parsed.kind === 'video'
    });
  }

  // Bring window to front
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  if (Array.isArray(commandLine)) {
    const protoArg = commandLine.find(arg => PROTOCOL_NAMES.some(p => arg.startsWith(`${p}://`)));
    if (protoArg) {
      handleProtocolUrl(protoArg);
    }
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  emitTauriEvent('update_available', {
    version: info.version,
    releaseNotes: info.releaseNotes
  });
});

autoUpdater.on('update-downloaded', (info) => {
  emitTauriEvent('update_downloaded', {
    version: info.version
  });
});

autoUpdater.on('error', (err) => {
  console.log('autoUpdater error:', err ? err.message : err);
  emitTauriEvent('update_error', {
    message: err ? err.message : 'Güncelleme hatası'
  });
});

app.whenReady().then(() => {
  prepareExtensionDirectory();
  createWindow();

  if (Array.isArray(process.argv)) {
    const protoArg = process.argv.find(arg => PROTOCOL_NAMES.some(p => arg.startsWith(`${p}://`)));
    if (protoArg) {
      handleProtocolUrl(protoArg);
    }
  }

  if (app.isPackaged) {
    // Check after 5 seconds on launch
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => console.log('Auto-update check on launch error:', e));
    }, 5000);

    // Periodic check every 1 hour
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((e) => console.log('Hourly update check error:', e));
    }, 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  downloader.killAll();
});

