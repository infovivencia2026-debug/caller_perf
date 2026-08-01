#!/usr/bin/env node
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pidFile = path.join(projectRoot, '.dev-server.pid');

if (!existsSync(pidFile)) {
  console.log('No dev server PID file found.');
  process.exit(0);
}

const pid = Number(readFileSync(pidFile, 'utf8').trim());
if (!Number.isInteger(pid)) {
  console.log('Invalid PID file content.');
  unlinkSync(pidFile);
  process.exit(0);
}

if (process.platform === 'win32') {
  const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'inherit' });
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
  process.exit(result.status ?? 0);
}

const result = spawnSync('kill', ['-9', String(pid)], { stdio: 'inherit' });
if (existsSync(pidFile)) {
  unlinkSync(pidFile);
}
process.exit(result.status ?? 0);
