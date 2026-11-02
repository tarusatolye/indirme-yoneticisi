// Downloads the Windows video tools into bin-win/ (packaged as resources/bin in the Windows build only):
//   yt-dlp.exe              latest official release, github.com/yt-dlp/yt-dlp
//   ffmpeg.exe              win64 LGPL build, github.com/BtbN/FFmpeg-Builds
// The macOS build keeps using bin/ (yt-dlp and ffmpeg for macOS).
// Usage: node scripts/fetch-win-tools.cjs [--force]
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'bin-win');
const force = process.argv.includes('--force');

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip';

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'indirme-yoneticisi-fetch-win-tools' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects > 5) return reject(new Error('Too many redirects: ' + url));
          return resolve(download(new URL(res.headers.location, url).toString(), dest, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      })
      .on('error', reject);
  });
}

function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const f = findFile(p, name);
      if (f) return f;
    } else if (e.name.toLowerCase() === name) return p;
  }
  return null;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const ytdlp = path.join(outDir, 'yt-dlp.exe');
  if (force || !fs.existsSync(ytdlp)) {
    console.log('▸ Downloading yt-dlp.exe');
    await download(YTDLP_URL, ytdlp);
  }
  if (force || !fs.existsSync(path.join(outDir, 'ffmpeg.exe'))) {
    console.log('▸ Downloading FFmpeg (win64, LGPL)');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-win-'));
    try {
      const zip = path.join(tmp, 'ffmpeg.zip');
      await download(FFMPEG_URL, zip);
      // bsdtar reads zip files on macOS and on Windows 10+.
      execFileSync('tar', ['-xf', zip, '-C', tmp]);
      for (const name of ['ffmpeg.exe']) {
        const f = findFile(tmp, name);
        if (!f) throw new Error(`${name} not found in the FFmpeg archive`);
        fs.copyFileSync(f, path.join(outDir, name));
      }
      const lic = findFile(tmp, 'license.txt');
      if (lic) fs.copyFileSync(lic, path.join(outDir, 'ffmpeg-license.txt'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log('✔ bin-win ready:', fs.readdirSync(outDir).join(', '));
})().catch((err) => {
  console.error('✖ fetch-win-tools failed:', err.message);
  process.exit(1);
});
