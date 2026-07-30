#!/usr/bin/env node
// Wrapper for scripts/check-stroke-coverage.py.
// The Python coverage gate needs a clean interpreter environment: the dev venv's
// PYTHONPATH / VIRTUAL_ENV leak in and shadow the Store Python's numpy/Pillow with
// broken wheels. This spawns the Store Python (the only Windows interpreter with
// numpy + Pillow + fonttools) with a scrubbed env. No-op on non-Windows hosts.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const isWin = process.platform === 'win32';
const storePython = join(homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'python.exe');

const python = isWin && existsSync(storePython) ? storePython : 'python3';

const env = { ...process.env };
delete env.PYTHONPATH;
delete env.VIRTUAL_ENV;
if (isWin) {
  // Scrub PATH down to system dirs + the Store python dir.
  env.PATH = [
    'C:\\Windows\\System32',
    'C:\\Windows',
    join(homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
  ].join(';');
}

const result = spawnSync(python, ['scripts/check-stroke-coverage.py', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
