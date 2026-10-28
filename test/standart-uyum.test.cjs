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

test('modal perdesi sabit bg-black yerine --perde token\'ından gelir', () => {
  const kaba = [];
  for (const f of kaynaklar(path.join(__dirname, '..', 'src', 'components'))) {
    const s = fs.readFileSync(f, 'utf8');
    if (/fixed inset-0[^"`']*\bbg-black\//.test(s)) kaba.push(`${f}: bg-black perde`);
  }
  assert.deepEqual(kaba, []);
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
  assert.match(css, /\.modal-perde\s*{[^}]*var\(--perde\)/);
});

test('arayüz metninde uzun tire, büyük harf CSS ve gizli satır işlemi yok', () => {
  const kaba = [];
  for (const f of kaynaklar(path.join(__dirname, '..', 'src'))) {
    const s = fs.readFileSync(f, 'utf8');
    if (/["'>]—["'<]/.test(s)) kaba.push(`${f}: uzun tire`);
    if (/\buppercase\b/.test(s)) kaba.push(`${f}: uppercase`);
    if (/opacity-0[^"`']*group-hover:opacity-100/.test(s)) kaba.push(`${f}: satır işlemi gizli`);
  }
  assert.deepEqual(kaba, []);
});
