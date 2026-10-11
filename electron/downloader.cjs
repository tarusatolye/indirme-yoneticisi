const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn, exec } = require('child_process');

const isWin = process.platform === 'win32';
const ytDlpBinName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const ffmpegBinName = isWin ? 'ffmpeg.exe' : 'ffmpeg';

function locateBinDir() {
  const dirs = [
    process.resourcesPath ? path.join(process.resourcesPath, 'bin') : null,
    !__dirname.includes('app.asar') ? path.join(__dirname, '..', 'bin') : null,
    !__dirname.includes('app.asar') ? path.join(__dirname, '..', 'Tools') : null,
    path.join(process.cwd(), 'bin'),
    path.join(process.cwd(), 'Tools'),
    process.execPath ? path.join(path.dirname(process.execPath), 'resources', 'bin') : null,
    process.execPath ? path.join(path.dirname(process.execPath), 'bin') : null,
    path.join(process.env.APPDATA || '', 'İndirme Yöneticisi', 'bin'),
    path.join(process.env.APPDATA || '', 'indirme-yoneticisi', 'bin'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin'
  ];
  for (const d of dirs) {
    if (d && !d.includes('app.asar') && fs.existsSync(d)) {
      const p = path.join(d, ytDlpBinName);
      if (fs.existsSync(p)) return d;
    }
  }
  return null;
}

function locateYtDlp() {
  const binDir = locateBinDir();
  if (binDir) return path.join(binDir, ytDlpBinName);
  return ytDlpBinName;
}

function locateFfmpeg(binDir) {
  if (binDir && fs.existsSync(path.join(binDir, ffmpegBinName))) {
    return binDir;
  }
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links');
  if (isWin && fs.existsSync(path.join(winget, ffmpegBinName))) {
    return winget;
  }
  const searchDirs = [
    path.join(process.env.APPDATA || '', 'İndirme Yöneticisi', 'bin'),
    path.join(process.env.APPDATA || '', 'indirme-yoneticisi', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin'
  ];
  for (const ad of searchDirs) {
    if (ad && fs.existsSync(path.join(ad, ffmpegBinName))) return ad;
  }
  return null;
}

function generateConcurrentSegments(total, downloaded, count = 8, isDownloading = true) {
  const segCount = count || 8;
  const dl = Math.max(0, parseInt(downloaded, 10) || 0);
  const tot = Math.max(0, parseInt(total, 10) || 0);

  if (tot <= 0) {
    const chunk = isDownloading ? Math.floor(dl / segCount) : 0;
    return Array.from({ length: segCount }, (_, i) => ({
      index: i,
      start: 0,
      end: 0,
      received: chunk,
      downloaded: chunk,
      active: isDownloading,
    }));
  }

  const chunkSize = Math.floor(tot / segCount);
  const basePerSeg = Math.floor(dl / segCount);

  return Array.from({ length: segCount }, (_, i) => {
    const start = i * chunkSize;
    const end = i === segCount - 1 ? tot - 1 : (i + 1) * chunkSize - 1;
    const segLen = Math.max(1, end - start + 1);
    const segRec = Math.min(segLen, basePerSeg);

    return {
      index: i,
      start,
      end,
      received: segRec,
      downloaded: segRec,
      active: isDownloading && segRec < segLen,
    };
  });
}

class SegmentedDownloader {
  constructor(emitProgress, emitComplete, emitError) {
    this.emitProgress = emitProgress;
    this.emitComplete = emitComplete;
    this.emitError = emitError;
    this.activeDownloads = new Map(); // id -> { paused: bool, workers: [] }
  }

  pause(id) {
    const d = this.activeDownloads.get(id);
    if (d) {
      d.paused = true;
      if (d.progressTimer) {
        clearInterval(d.progressTimer);
        d.progressTimer = null;
      }
      if (d.abortControllers && d.abortControllers.length > 0) {
        d.abortControllers.forEach(c => {
          try { c.abort(); } catch (e) {}
        });
        d.abortControllers = [];
      }
      if (d.fd !== null && d.fd !== undefined) {
        try { fs.closeSync(d.fd); } catch (e) {}
        d.fd = null;
      }
      if (d.fileStream) {
        try { d.fileStream.end(); } catch (e) {}
        d.fileStream = null;
      }
      if (d.process) {
        const proc = d.process;
        d.process = null;
        try {
          if (process.platform === 'win32' && proc.pid) {
            const { execSync } = require('child_process');
            try {
              execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
            } catch (tkErr) {
              try { proc.kill('SIGKILL'); } catch (e2) {}
            }
          } else {
            proc.kill('SIGKILL');
          }
        } catch (e) {}
      }
      this.activeDownloads.delete(id);
    }
  }

  killAll() {
    for (const id of Array.from(this.activeDownloads.keys())) {
      this.pause(id);
    }
  }

  async start(item, segmentCount = 8) {
    const id = item.id;
    const url = item.url;

    // Clean up any existing active state for this id first
    this.pause(id);

    const state = {
      paused: false,
      abortControllers: [],
      process: null,
      progressTimer: null,
      fd: null,
      fileStream: null,
    };
    this.activeDownloads.set(id, state);

    if (item.is_video_stream) {
      return this.startVideoDownload(item, state, segmentCount);
    }

    const savePath = item.save_path || item.savePath || path.join(process.env.USERPROFILE || '', 'Downloads', 'download');
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    }

    try {
      // Probe headers for Content-Length and Range support
      const probeHeaders = {};
      if (item.user_agent) probeHeaders['User-Agent'] = item.user_agent;
      if (item.referrer) probeHeaders['Referer'] = item.referrer;
      if (item.cookies) probeHeaders['Cookie'] = item.cookies;
      probeHeaders['Range'] = 'bytes=0-0';

      const resp = await fetch(url, { method: 'GET', headers: probeHeaders });
      const acceptRanges = resp.headers.get('accept-ranges') === 'bytes' || resp.status === 206;
      let totalSize = item.total_size || item.totalBytes || 0;

      const contentRange = resp.headers.get('content-range');
      if (contentRange) {
        const parts = contentRange.split('/');
        if (parts.length > 1) totalSize = parseInt(parts[1], 10) || totalSize;
      } else {
        const cl = resp.headers.get('content-length');
        if (cl) totalSize = parseInt(cl, 10) || totalSize;
      }

      if (state.paused) return;

      if (acceptRanges && totalSize > 1024 * 1024 && segmentCount > 1) {
        await this.startMultiPart(item, totalSize, segmentCount, state);
      } else {
        await this.startSingleStream(item, totalSize, state);
      }
    } catch (err) {
      if (!state.paused) {
        this.emitError(id, err.message);
      }
    }
  }

  async startMultiPart(item, totalSize, segmentCount, state) {
    const id = item.id;
    const savePath = item.save_path || item.savePath;
    const chunkSize = Math.floor(totalSize / segmentCount);

    let fd;
    try {
      const fileExisted = fs.existsSync(savePath);
      fd = fs.openSync(savePath, fileExisted ? 'r+' : 'w');
      state.fd = fd;
      if (!fileExisted || fs.statSync(savePath).size < totalSize) {
        try { fs.ftruncateSync(fd, totalSize); } catch (e) {}
      }
    } catch (openErr) {
      if (!state.paused) {
        this.emitError(id, `Dosya açılamadı: ${openErr.message}`);
      }
      return;
    }

    let segments = [];
    if (Array.isArray(item.segments) && item.segments.length === segmentCount) {
      segments = item.segments.map(s => {
        const dl = s.downloaded || s.received || 0;
        const segLen = s.end - s.start + 1;
        return {
          index: s.index,
          start: s.start,
          end: s.end,
          received: Math.min(dl, segLen),
          downloaded: Math.min(dl, segLen),
          active: dl < segLen
        };
      });
    } else {
      for (let i = 0; i < segmentCount; i++) {
        const start = i * chunkSize;
        const end = i === segmentCount - 1 ? totalSize - 1 : (i + 1) * chunkSize - 1;
        segments.push({
          index: i,
          start,
          end,
          received: 0,
          downloaded: 0,
          active: true
        });
      }
    }

    let downloadedTotal = segments.reduce((acc, s) => acc + (s.downloaded || 0), 0);
    let lastBytes = downloadedTotal;
    let lastTime = Date.now();

    const progressTimer = setInterval(() => {
      if (state.paused) return;
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      const speed = elapsed > 0 ? Math.round((downloadedTotal - lastBytes) / elapsed) : 0;
      lastBytes = downloadedTotal;
      lastTime = now;

      item.downloaded_size = downloadedTotal;
      item.receivedBytes = downloadedTotal;
      item.segments = segments;

      this.emitProgress(id, {
        downloaded: downloadedTotal,
        total: totalSize,
        speed,
        segments: [...segments]
      });
    }, 400);
    state.progressTimer = progressTimer;

    const downloadChunk = async (seg) => {
      if (state.paused) return;
      const segLen = seg.end - seg.start + 1;
      if (seg.downloaded >= segLen) {
        seg.active = false;
        return;
      }
      seg.active = true;

      const controller = new AbortController();
      state.abortControllers.push(controller);

      const headers = {};
      if (item.user_agent) headers['User-Agent'] = item.user_agent;
      if (item.referrer) headers['Referer'] = item.referrer;
      if (item.cookies) headers['Cookie'] = item.cookies;
      headers['Range'] = `bytes=${seg.start + seg.downloaded}-${seg.end}`;

      let res;
      try {
        res = await fetch(item.url, {
          headers,
          signal: controller.signal
        });
      } catch (fetchErr) {
        if (state.paused) return;
        throw fetchErr;
      }

      if (!res.ok && res.status !== 206) {
        if (state.paused) return;
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      let writePos = seg.start + seg.downloaded;
      const reader = res.body.getReader();

      while (!state.paused) {
        let chunkResult;
        try {
          chunkResult = await reader.read();
        } catch (e) {
          if (state.paused) break;
          throw e;
        }
        const { done, value } = chunkResult;
        if (done) {
          seg.active = false;
          break;
        }
        if (value) {
          if (state.paused) break;
          try {
            if (state.fd !== null && state.fd !== undefined) {
              fs.writeSync(state.fd, value, 0, value.length, writePos);
              writePos += value.length;
              seg.downloaded += value.length;
              seg.received = seg.downloaded;
              downloadedTotal += value.length;
            }
          } catch (writeErr) {
            if (state.paused) break;
            throw writeErr;
          }
        }
      }
      seg.active = false;
    };

    try {
      await Promise.all(segments.map(seg => downloadChunk(seg)));
      if (progressTimer) clearInterval(progressTimer);
      state.progressTimer = null;
      if (state.fd !== null && state.fd !== undefined) {
        try { fs.closeSync(state.fd); } catch (e) {}
        state.fd = null;
      }

      if (!state.paused && downloadedTotal >= totalSize) {
        this.emitComplete(id);
      }
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      state.progressTimer = null;
      if (state.fd !== null && state.fd !== undefined) {
        try { fs.closeSync(state.fd); } catch (e) {}
        state.fd = null;
      }
      if (!state.paused) {
        this.emitError(id, err.message);
      }
    }
  }

  async startSingleStream(item, totalSize, state) {
    const id = item.id;
    const savePath = item.save_path || item.savePath;

    let downloaded = 0;
    if (fs.existsSync(savePath)) {
      try {
        const stat = fs.statSync(savePath);
        downloaded = stat.size;
      } catch (e) {}
    }

    const file = fs.createWriteStream(savePath, { flags: downloaded > 0 ? 'a' : 'w' });
    state.fileStream = file;

    const controller = new AbortController();
    state.abortControllers.push(controller);

    const headers = {};
    if (item.user_agent) headers['User-Agent'] = item.user_agent;
    if (item.referrer) headers['Referer'] = item.referrer;
    if (item.cookies) headers['Cookie'] = item.cookies;
    if (downloaded > 0) {
      headers['Range'] = `bytes=${downloaded}-`;
    }

    let lastBytes = downloaded;
    let lastTime = Date.now();

    const progressTimer = setInterval(() => {
      if (state.paused) return;
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      const speed = elapsed > 0 ? Math.round((downloaded - lastBytes) / elapsed) : 0;
      lastBytes = downloaded;
      lastTime = now;

      item.downloaded_size = downloaded;
      item.receivedBytes = downloaded;

      this.emitProgress(id, {
        downloaded,
        total: totalSize || downloaded,
        speed,
        segments: []
      });
    }, 400);
    state.progressTimer = progressTimer;

    try {
      const res = await fetch(item.url, { headers, signal: controller.signal });
      if (!res.ok && res.status !== 206 && res.status !== 200) {
        if (state.paused) return;
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      // If server does not support Range and sent 200 instead of 206 when we requested offset
      if (res.status === 200 && downloaded > 0) {
        downloaded = 0;
        try {
          file.close();
          const truncatedFile = fs.createWriteStream(savePath, { flags: 'w' });
          state.fileStream = truncatedFile;
        } catch (e) {}
      }

      const reader = res.body.getReader();

      while (!state.paused) {
        let chunkResult;
        try {
          chunkResult = await reader.read();
        } catch (e) {
          if (state.paused) break;
          throw e;
        }
        const { done, value } = chunkResult;
        if (done) break;
        if (value) {
          if (state.paused) break;
          try {
            if (state.fileStream) {
              state.fileStream.write(Buffer.from(value));
              downloaded += value.length;
            }
          } catch (writeErr) {
            if (state.paused) break;
            throw writeErr;
          }
        }
      }

      if (progressTimer) clearInterval(progressTimer);
      state.progressTimer = null;
      if (state.fileStream) {
        try { state.fileStream.end(); } catch (e) {}
        state.fileStream = null;
      }

      if (!state.paused) {
        this.emitComplete(id);
      }
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      state.progressTimer = null;
      if (state.fileStream) {
        try { state.fileStream.end(); } catch (e) {}
        state.fileStream = null;
      }
      if (!state.paused) {
        this.emitError(id, err.message);
      }
    }
  }

  startVideoDownload(item, state, segmentCount = 8) {
    const id = item.id;
    const binDir = locateBinDir();
    const exe = binDir ? path.join(binDir, 'yt-dlp.exe') : locateYtDlp();
    const ffmpegDir = locateFfmpeg(binDir);

    let saveDir = item.savePath || item.save_path ? path.dirname(item.savePath || item.save_path) : '';
    if (!saveDir || saveDir === '.' || !fs.existsSync(saveDir)) {
      saveDir = path.join(process.env.USERPROFILE || '', 'Downloads');
    }
    if (!fs.existsSync(saveDir)) {
      try { fs.mkdirSync(saveDir, { recursive: true }); } catch (e) {}
    }

    // Clean file template without random bracket ID suffix
    const outTemplate = path.join(saveDir, '%(title).150B.%(ext)s');

    const args = [
      '--newline',
      '--no-playlist',
      '--no-colors',
      '--progress',
      '--continue',
      '--no-simulate',
      '--no-mtime',
      '--no-check-certificates',
      '--encoding', 'utf-8',
      '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      '--merge-output-format', 'mp4',
      '-N', String(segmentCount || 8),
      '-o', outTemplate,
      '--print', 'TITLE|%(title)s',
      '--print', 'FILENAME|%(filename)s',
      '--print', 'after_move:filepath',
      '--progress-template', 'DMP|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s',
    ];

    if (ffmpegDir) {
      args.push('--ffmpeg-location', ffmpegDir);
    }

    // Try node for faster YouTube extraction if available
    args.push('--js-runtimes', 'node');

    if (item.referrer) args.push('--referer', item.referrer);
    if (item.user_agent) args.push('--user-agent', item.user_agent);

    args.push(item.url);

    let stderr = '';
    let lastPrintedFile = null;
    let streamOffset = 0;
    let lastStreamDownloaded = 0;

    let proc;
    try {
      proc = spawn(exe, args, {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          LC_ALL: 'en_US.UTF-8',
          LANG: 'en_US.UTF-8'
        }
      });
    } catch (spawnErr) {
      this.emitError(id, `yt-dlp başlatılamadı (${spawnErr.message}). Yol: ${exe}`);
      return;
    }
    state.process = proc;
    if (state.paused) {
      try {
        if (process.platform === 'win32' && proc.pid) {
          const { execSync } = require('child_process');
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          proc.kill('SIGKILL');
        }
      } catch (e) {}
      return;
    }

    proc.stdout.on('data', (chunk) => {
      if (state.paused) return;
      const text = chunk.toString('utf8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;

        // 1. Capture title as soon as yt-dlp extracts metadata
        if (line.startsWith('TITLE|')) {
          const actualTitle = line.substring(6).trim();
          if (actualTitle && actualTitle !== 'YouTube' && actualTitle !== 'Video') {
            item.fileName = actualTitle;
            item.file_name = actualTitle;
            this.emitProgress(id, {
              downloaded: item.downloaded_size || item.receivedBytes || 0,
              total: item.total_size || item.totalBytes || 0,
              speed: item.speed || 0,
              fileName: actualTitle,
              file_name: actualTitle,
              segments: generateConcurrentSegments(item.total_size || item.totalBytes, item.downloaded_size || item.receivedBytes, segmentCount, true)
            });
          }
          continue;
        }

        // 2. Capture planned destination filename
        if (line.startsWith('FILENAME|')) {
          const actualFileName = line.substring(9).trim();
          if (actualFileName) {
            const fullPath = path.isAbsolute(actualFileName) ? actualFileName : path.join(saveDir, actualFileName);
            lastPrintedFile = fullPath;
            item.savePath = fullPath;
            item.save_path = fullPath;
            if (!item.fileName || item.fileName === 'YouTube' || item.fileName === 'Video' || item.fileName.startsWith('download_') || item.fileName.startsWith('Video İndir')) {
              item.fileName = path.basename(actualFileName);
              item.file_name = path.basename(actualFileName);
            }
          }
          continue;
        }

        // 3. Capture high-resolution progress (DMP|...)
        if (line.startsWith('DMP|') || line.startsWith('download:DMP|')) {
          const rawLine = line.startsWith('download:DMP|') ? line.substring(9) : line;
          const parts = rawLine.split('|');
          const dlBytes = parseInt(parts[1], 10) || 0;
          let totBytes = parseInt(parts[2], 10);
          if (isNaN(totBytes) || totBytes <= 0) {
            totBytes = parseInt(parts[3], 10) || 0;
          }
          const speed = parseFloat(parts[4]) || 0;

          // Multi-format stream transition (video stream -> audio stream)
          if (dlBytes < lastStreamDownloaded && lastStreamDownloaded > 500 * 1024) {
            streamOffset += lastStreamDownloaded;
          }
          lastStreamDownloaded = dlBytes;

          const overallDownloaded = streamOffset + dlBytes;
          const overallTotal = Math.max(item.totalBytes || item.total_size || 0, streamOffset + totBytes);

          item.receivedBytes = overallDownloaded;
          item.downloaded_size = overallDownloaded;
          if (overallTotal > 0) {
            item.totalBytes = overallTotal;
            item.total_size = overallTotal;
          }
          item.speed = Math.round(speed);

          const segments = generateConcurrentSegments(overallTotal, overallDownloaded, segmentCount, true);

          this.emitProgress(id, {
            downloaded: overallDownloaded,
            total: overallTotal,
            speed: Math.round(speed),
            segments
          });
          continue;
        }

        // 4. Fallback for standard yt-dlp [download] progress text
        if (line.startsWith('[download]')) {
          const match = line.match(/([\d.]+)%\s+of\s+~?([\d.]+)\s*([KMGT]?i?B)(?:\s+at\s+([\d.]+)\s*([KMGT]?i?B\/s))?/i);
          if (match) {
            const pct = parseFloat(match[1]) || 0;
            const sizeVal = parseFloat(match[2]) || 0;
            const sizeUnit = match[3] || 'MiB';
            const speedVal = parseFloat(match[4]) || 0;
            const speedUnit = match[5] || 'MiB/s';

            const toBytes = (val, unit) => {
              const u = unit.toLowerCase();
              if (u.includes('k')) return val * 1024;
              if (u.includes('m')) return val * 1024 * 1024;
              if (u.includes('g')) return val * 1024 * 1024 * 1024;
              return val;
            };

            const tot = toBytes(sizeVal, sizeUnit);
            const dl = Math.round((pct / 100) * tot);
            const spd = toBytes(speedVal, speedUnit);

            if (dl > 0) {
              item.receivedBytes = dl;
              item.downloaded_size = dl;
            }
            if (tot > 0) {
              item.totalBytes = tot;
              item.total_size = tot;
            }
            if (spd > 0) {
              item.speed = Math.round(spd);
            }

            const segments = generateConcurrentSegments(item.total_size || tot, item.downloaded_size || dl, segmentCount, true);

            this.emitProgress(id, {
              downloaded: item.downloaded_size || dl,
              total: item.total_size || tot,
              speed: item.speed || Math.round(spd),
              segments
            });
            continue;
          }
        }

        // 5. Final file path after move
        const trimmed = line.trim();
        if (trimmed.includes('\\') || trimmed.includes('/')) {
          lastPrintedFile = trimmed;
          if (fs.existsSync(trimmed)) {
            item.savePath = trimmed;
            item.save_path = trimmed;
            item.fileName = path.basename(trimmed);
            item.file_name = path.basename(trimmed);
          }
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (state.paused) return;
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (state.paused) return;
      if (code === 0) {
        if (lastPrintedFile && fs.existsSync(lastPrintedFile)) {
          item.savePath = lastPrintedFile;
          item.save_path = lastPrintedFile;
          item.fileName = path.basename(lastPrintedFile);
          item.file_name = path.basename(lastPrintedFile);
          try {
            const stat = fs.statSync(lastPrintedFile);
            if (stat.size > 0) {
              item.totalBytes = stat.size;
              item.total_size = stat.size;
              item.receivedBytes = stat.size;
              item.downloaded_size = stat.size;
            }
          } catch (e) {}
        }
        const finalTot = item.totalBytes || item.total_size || 0;
        item.receivedBytes = finalTot;
        item.downloaded_size = finalTot;
        item.speed = 0;
        item.segments = generateConcurrentSegments(finalTot, finalTot, segmentCount, false);
        this.emitComplete(id);
      } else {
        const lines = stderr.trim().split(/\r?\n/).filter(Boolean);
        const errSummary = lines.slice(-2).join(' ') || `yt-dlp exited with code ${code}`;
        this.emitError(id, errSummary);
      }
    });

    proc.on('error', (err) => {
      if (!state.paused) {
        this.emitError(id, `yt-dlp hatası (${err.message}). Yol: ${exe}`);
      }
    });
  }
}

module.exports = { SegmentedDownloader };
