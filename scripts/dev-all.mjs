#!/usr/bin/env node
// Boot every workspace dev server in parallel with colour-coded labels.
// Zero deps — uses Node's child_process + ANSI escapes only.
//
// Usage:
//   yarn dev              # all 14 services + web
//   yarn dev core seo web # only the listed targets

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// (name, workspace, port). Port is informational — printed once on boot.
const TARGETS = [
  ['core',        '@marketing/marketing-core',     3100],
  ['seo',         '@marketing/seo-engine',         3101],
  ['content',     '@marketing/content-ai',         3102],
  ['campaign',    '@marketing/campaign-manager',   3103],
  ['analytics',   '@marketing/analytics-engine',   3104],
  ['social',      '@marketing/social-hub',         3105],
  ['email',       '@marketing/email-hub',          3106],
  ['intel',       '@marketing/intelligence',       3107],
  ['affiliate',   '@marketing/affiliate-hub',      3108],
  ['influencer',  '@marketing/influencer-hub',     3109],
  ['crm',         '@marketing/crm-automation',     3110],
  ['media',       '@marketing/media-hub',          3111],
  ['notif',       '@marketing/notification-service', 3112],
  ['integration', '@marketing/integration-service', 3113],
  ['web',         '@marketing/web',                3000],
];

// ANSI colours chosen for legibility on both dark and light terminals.
const COLOURS = ['36', '32', '33', '35', '34', '31', '96', '92', '93', '95', '94', '91', '37', '90', '97'];

const requested = process.argv.slice(2);
const selected = requested.length === 0
  ? TARGETS
  : TARGETS.filter(([name]) => requested.includes(name));

if (selected.length === 0) {
  console.error(`No matching targets. Known: ${TARGETS.map(([n]) => n).join(', ')}`);
  process.exit(1);
}

const widest = Math.max(...selected.map(([n]) => n.length));
const pad = (s) => s.padEnd(widest, ' ');

console.log('\nBooting:');
for (const [name, , port] of selected) {
  console.log(`  ${pad(name)}  →  port ${port}`);
}
console.log('\nCtrl-C to stop all.\n');

const children = [];

function prefixStream(stream, name, colour) {
  const tag = `\x1b[${colour}m[${pad(name)}]\x1b[0m `;
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.length > 0) process.stdout.write(tag + line + '\n');
    }
  });
  stream.on('end', () => {
    if (buf.length > 0) process.stdout.write(tag + buf + '\n');
  });
}

for (let i = 0; i < selected.length; i++) {
  const [name, workspace] = selected[i];
  const colour = COLOURS[i % COLOURS.length];
  // Use yarn workspace … dev so we honour each package's own dev script
  // (tsx watch for services, vite for web).
  const child = spawn('yarn', ['workspace', workspace, 'dev'], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  prefixStream(child.stdout, name, colour);
  prefixStream(child.stderr, name, colour);
  child.on('exit', (code, signal) => {
    const reason = signal ?? `exit ${code}`;
    process.stdout.write(`\x1b[${colour}m[${pad(name)}]\x1b[0m exited (${reason})\n`);
  });
  children.push({ name, child });
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal} — stopping ${children.length} service${children.length === 1 ? '' : 's'}…`);
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  // Hard-kill any laggards.
  setTimeout(() => {
    for (const { child } of children) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(0);
  }, 5_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
