/**
 * Updates public/embeddable with the latest ringcentral-embeddable extension build.
 *
 * 1. Switches this repo to the beta branch (skipped with --no-checkout)
 * 2. Downloads the zip of ringcentral-embeddable branch 3.1.x-extension-build
 * 3. Extracts it over public/embeddable (overwriting existing files)
 * 4. Deletes public/embeddable/index.html
 *
 * Usage: node scripts/beta-update-embeddable.mjs [--no-checkout]
 *
 * --no-checkout leaves the current branch alone, for runners (e.g. auto-dev)
 * that manage the branch/worktree themselves.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRANCH = 'beta';
const EMBEDDABLE_BRANCH = '3.1.x-extension-build';
const ZIP_URL = `https://github.com/ringcentral/ringcentral-embeddable/archive/refs/heads/${EMBEDDABLE_BRANCH}.zip`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipCheckout = process.argv.includes('--no-checkout');
const target = path.join(repoRoot, 'public', 'embeddable');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function extractZip(zipPath, destination) {
  fs.mkdirSync(destination, { recursive: true });
  if (process.platform === 'win32') {
    // Windows ships bsdtar, which can read zip files.
    const systemTar = path.join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'tar.exe');
    run(systemTar, ['-xf', zipPath, '-C', destination]);
  } else {
    run('unzip', ['-q', zipPath, '-d', destination]);
  }
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'embeddable-'));
try {
  if (!skipCheckout) {
    console.log(`Switching to ${BRANCH}...`);
    run('git', ['-C', repoRoot, 'checkout', BRANCH]);
  }

  console.log(`Downloading ${ZIP_URL}...`);
  const response = await fetch(ZIP_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  const zipPath = path.join(work, 'embeddable.zip');
  fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

  const extracted = path.join(work, 'extracted');
  extractZip(zipPath, extracted);

  // GitHub zips contain a single top-level folder; copy its contents.
  const [root] = fs.readdirSync(extracted, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (!root) throw new Error('Unexpected zip layout: no top-level folder');

  console.log(`Copying into ${target}...`);
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(path.join(extracted, root.name), target, { recursive: true, force: true });

  fs.rmSync(path.join(target, 'index.html'), { force: true });
  console.log('Removed index.html');
  console.log('Done.');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
