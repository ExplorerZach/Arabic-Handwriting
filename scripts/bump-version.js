import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/bump-version.js <x.y.z>');
  process.exit(1);
}

// package.json
const pkgPath = join(root, 'package.json');
let pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`[bump] package.json → ${version}`);

// tauri.conf.json
const tauriConfPath = join(root, 'src-tauri', 'tauri.conf.json');
let tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`[bump] src-tauri/tauri.conf.json → ${version}`);

// Cargo.toml — only the [package] version line, not dependency versions
const cargoPath = join(root, 'src-tauri', 'Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^(\s*version\s*=\s*)"[\d.]+"/m, (_, prefix) => `${prefix}"${version}"`);
writeFileSync(cargoPath, cargo);
console.log(`[bump] src-tauri/Cargo.toml → ${version}`);
