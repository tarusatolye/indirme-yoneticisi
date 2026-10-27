const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function kaynaklar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return kaynaklar(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

test('arayüzde yerel select, alert ve confirm kullanılmaz', () => {
  const kaba = [];
  for (const f of kaynaklar(path.join(__dirname, '..', 'src'))) {
    const s = fs.readFileSync(f, 'utf8');
    if (/<select[\s>]/.test(s)) kaba.push(`${f}: <select>`);
    if (/\b(window\.)?(alert|confirm)\(/.test(s)) kaba.push(`${f}: alert/confirm`);
  }
  assert.deepEqual(kaba, []);
});
