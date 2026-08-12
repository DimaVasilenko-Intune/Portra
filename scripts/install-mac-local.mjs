#!/usr/bin/env node
// Installs a locally built Portra into /Applications.
//
// A local build is never quarantined, so it launches without the Gatekeeper prompt that blocks
// downloaded builds. See docs/MACOS.md.

import { existsSync, readdirSync, rmSync, mkdirSync, accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

if (process.platform !== 'darwin') {
  console.error('This script only applies to macOS.');
  process.exit(1);
}

// electron-builder names the output directory after the arch it built for
// (mac-arm64, mac, mac-universal), so find the bundle rather than guessing.
const releaseDir = 'release';
const candidates = existsSync(releaseDir)
  ? readdirSync(releaseDir)
      .filter((d) => d.startsWith('mac') && !d.endsWith('-temp'))
      .map((d) => join(releaseDir, d, 'Portra.app'))
      .filter(existsSync)
  : [];

if (!candidates.length) {
  console.error('No built Portra.app found under release/. Run: npm run build && electron-builder -m dir');
  process.exit(1);
}

const source = candidates[0];

// macOS 13+ gates modifying anything inside /Applications behind the App Management
// permission, which a terminal usually does not have — replacing an existing app there fails
// with EACCES even for an admin user. ~/Applications carries no such gate and works
// identically for Spotlight and Launchpad, so prefer it and only use /Applications when it is
// genuinely writable.
function pickInstallDir() {
  try {
    accessSync('/Applications', constants.W_OK);
    // Writable is not sufficient — App Management denials also surface here.
    const probe = '/Applications/.portra-install-probe';
    mkdirSync(probe);
    rmSync(probe, { recursive: true, force: true });
    return '/Applications';
  } catch {
    const userApps = join(homedir(), 'Applications');
    mkdirSync(userApps, { recursive: true });
    return userApps;
  }
}

const installDir = pickInstallDir();
const target = join(installDir, 'Portra.app');

console.log(`Installing ${source} -> ${target}`);
if (installDir !== '/Applications') {
  console.log('(/Applications is not writable from a terminal — see docs/MACOS.md)');
}

try {
  execFileSync('pkill', ['-f', 'Portra.app/Contents/MacOS/Portra'], { stdio: 'ignore' });
} catch {
  // Not running — nothing to stop.
}

rmSync(target, { recursive: true, force: true });
execFileSync('cp', ['-R', source, installDir + '/'], { stdio: 'inherit' });
execFileSync('xattr', ['-dr', 'com.apple.quarantine', target], { stdio: 'ignore' });

// Report whether Gatekeeper would accept this build, so the signing status is never a surprise.
try {
  execFileSync('spctl', ['-a', '-t', 'exec', target], { stdio: 'ignore' });
  console.log('Gatekeeper: accepted (signed build).');
} catch {
  console.log('Gatekeeper: rejected (unsigned build) — quarantine stripped, so it will still launch.');
  console.log('A downloaded build would need the same treatment. See docs/MACOS.md.');
}

execFileSync('open', [target], { stdio: 'inherit' });
console.log(`Portra launched from ${target}`);
