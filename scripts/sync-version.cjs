// package.json is the single source of the version; copy it into the browser extension's manifest.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const manifestPath = path.join(root, 'Extension', 'manifest.json');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const updated = manifest.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
if (updated !== manifest) {
  fs.writeFileSync(manifestPath, updated);
  console.log(`Extension/manifest.json -> ${version}`);
}
