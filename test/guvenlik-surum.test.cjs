const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// HATA-0482 / CVE-2026-115570 (GHSA-jr5w-w6x2-84p9): Electron 44.x'te 44.9.1 öncesi
// ele geçirilmiş eMudhra ara sertifikalarını engellemiyor.
const ENAZ = [44, 9, 1];

function karsilastir(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

test('paketlenen Electron CVE-2026-115570 yamasını içerir (>= 44.9.1)', () => {
  const kilit = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  const surum = kilit.packages['node_modules/electron'].version;
  const parca = surum.split('-')[0].split('.').map(Number);
  assert.ok(karsilastir(parca, ENAZ) >= 0, `electron ${surum} < ${ENAZ.join('.')}`);
});
