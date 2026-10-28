const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { parseProtocolUrl, PROTOCOL_NAMES, registerProtocolClients } = require('../electron/protocol.cjs');
const { createServer } = require('../electron/server.cjs');

test('PROTOCOL_NAMES includes indirmeyoneticisi and tarus-dm', () => {
  assert.ok(PROTOCOL_NAMES.includes('indirmeyoneticisi'));
  assert.ok(PROTOCOL_NAMES.includes('tarus-dm'));
});

test('parseProtocolUrl parses open scheme correctly', () => {
  const res1 = parseProtocolUrl('indirmeyoneticisi://open');
  assert.deepEqual(res1, { action: 'open' });

  const res2 = parseProtocolUrl('tarus-dm://open');
  assert.deepEqual(res2, { action: 'open' });

  const res3 = parseProtocolUrl('indirmeyoneticisi:///');
  assert.deepEqual(res3, { action: 'open' });
});

test('parseProtocolUrl parses download scheme with query parameters', () => {
  const raw = 'indirmeyoneticisi://download?url=https%3A%2F%2Fexample.com%2Fvideo.mp4&filename=test.mp4&kind=video&referer=https%3A%2F%2Fexample.com';
  const res = parseProtocolUrl(raw);

  assert.equal(res.action, 'download');
  assert.equal(res.url, 'https://example.com/video.mp4');
  assert.equal(res.fileName, 'test.mp4');
  assert.equal(res.kind, 'video');
  assert.equal(res.referer, 'https://example.com');
});

test('parseProtocolUrl handles invalid or unrelated schemes gracefully', () => {
  assert.equal(parseProtocolUrl(null), null);
  assert.equal(parseProtocolUrl(''), null);
  assert.equal(parseProtocolUrl('https://example.com'), null);
  assert.equal(parseProtocolUrl('ftp://example.com'), null);
  assert.equal(parseProtocolUrl('not-a-valid-url'), null);
});

test('registerProtocolClients safely handles mocked app', () => {
  const registered = [];
  const mockApp = {
    setAsDefaultProtocolClient(proto) {
      registered.push(proto);
    }
  };
  registerProtocolClients(mockApp, '/fake/path');
  assert.deepEqual(registered, ['indirmeyoneticisi', 'tarus-dm']);
});

test('Server ping and download endpoints work with mock downloads', async () => {
  const testPort = 48299;
  const mockDownloads = [
    { id: '1', file_name: 'test.mp4', total_size: 1000, downloaded_size: 500, speed: 100, status: 'downloading' }
  ];
  let addedDownload = null;

  const server = createServer(
    testPort,
    () => mockDownloads,
    (req) => {
      addedDownload = { id: 'new_1', ...req };
      return addedDownload;
    },
    () => {},
    () => {}
  );

  try {
    // 1. Test /ping
    const pingRes = await fetch(`http://127.0.0.1:${testPort}/ping`);
    assert.equal(pingRes.status, 200);
    const pingJson = await pingRes.json();
    assert.equal(pingJson.running, true);
    assert.equal(pingJson.active, 1);

    // 2. Test /download
    const dlRes = await fetch(`http://127.0.0.1:${testPort}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://youtube.com/watch?v=xyz',
        filename: 'My Video.mp4',
        referer: 'https://youtube.com',
        kind: 'video'
      })
    });
    assert.equal(dlRes.status, 200);
    const dlJson = await dlRes.json();
    assert.equal(dlJson.ok, true);
    assert.equal(dlJson.id, 'new_1');
    assert.equal(addedDownload.url, 'https://youtube.com/watch?v=xyz');
    assert.equal(addedDownload.is_video_stream, true);
  } finally {
    server.close();
  }
});

test('Auto-launch & retry flow: extension succeeds once app wakes up', async () => {
  const testPort = 48298;
  let serverInstance = null;
  let appStarted = false;

  // Function simulating the extension sendToApp logic
  async function simulateSendToApp(payload) {
    const post = async () => {
      const r = await fetch(`http://127.0.0.1:${testPort}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return r.json();
    };

    try {
      const j = await post();
      if (!j.ok) throw new Error(j.error);
      return { ok: true, id: j.id };
    } catch {
      // Simulate launchApp() trigger
      appStarted = true;
      // Start server with a slight delay simulating Electron startup time
      setTimeout(() => {
        serverInstance = createServer(
          testPort,
          () => [],
          (req) => ({ id: 'launched_dl_1', ...req }),
          () => {},
          () => {}
        );
      }, 100);

      // Poll until online (retry mechanism)
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 50));
        try {
          const ping = await fetch(`http://127.0.0.1:${testPort}/ping`);
          if (ping.ok) {
            const j = await post();
            if (j.ok) return { ok: true, id: j.id, launched: true };
          }
        } catch {}
      }
      return { ok: false, error: 'timeout' };
    }
  }

  const result = await simulateSendToApp({
    url: 'https://example.com/video.mp4',
    filename: 'video.mp4',
    kind: 'video'
  });

  assert.equal(result.ok, true);
  assert.equal(result.id, 'launched_dl_1');
  assert.equal(result.launched, true);
  assert.equal(appStarted, true);

  if (serverInstance) {
    serverInstance.close();
  }
});

test('Windows portable registers protocol to the real exe, not the temp extraction dir', () => {
  const registered = [];
  const mockApp = {
    setAsDefaultProtocolClient(proto, exe, args) {
      registered.push([proto, exe, args]);
    }
  };
  const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const origDefaultApp = process.defaultApp;
  const origPortable = process.env.PORTABLE_EXECUTABLE_FILE;
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.defaultApp = false;
    process.env.PORTABLE_EXECUTABLE_FILE = 'D:\\Apps\\Indirme Yoneticisi.exe';
    registerProtocolClients(mockApp);
  } finally {
    Object.defineProperty(process, 'platform', origPlatform);
    process.defaultApp = origDefaultApp;
    if (origPortable === undefined) delete process.env.PORTABLE_EXECUTABLE_FILE;
    else process.env.PORTABLE_EXECUTABLE_FILE = origPortable;
  }
  assert.deepEqual(registered, PROTOCOL_NAMES.map(p => [p, 'D:\\Apps\\Indirme Yoneticisi.exe', []]));
});

test('Windows NSIS installer registers every protocol scheme before first launch', () => {
  const fs = require('fs');
  const path = require('path');
  const nsh = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');
  assert.match(nsh, /!macro customInstall/);
  assert.match(nsh, /"URL Protocol" ""/);
  assert.match(nsh, /shell\\open\\command" "" '"\$appExe" "%1"'/);
  for (const proto of PROTOCOL_NAMES) {
    assert.ok(nsh.includes(`!insertmacro registerUrlProtocol "${proto}"`), `${proto} not registered by installer`);
  }
});

test('macOS bundle declares every protocol scheme (Info.plist CFBundleURLTypes) so a closed app can be launched', () => {
  const pkg = require('../package.json');
  const schemes = [].concat(...[].concat(pkg.build.protocols || []).map(p => p.schemes || []));
  for (const proto of PROTOCOL_NAMES) {
    assert.ok(schemes.includes(proto), `${proto} missing from build.protocols`);
  }
});
