#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pidFile = path.join(projectRoot, '.dev-server.pid');

const child = process.platform === 'win32'
  ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    })
  : spawn('npm', ['run', 'dev'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });

if (child.pid) {
  writeFileSync(pidFile, String(child.pid), 'utf8');
}

child.on('exit', (code, signal) => {
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
  process.exit(code ?? (signal ? 1 : 0));
});

child.on('error', (error) => {
  console.error('Failed to start development server:', error.message);
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
  process.exit(1);
});
