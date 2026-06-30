const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function normalizeExtensionPath(extensionPath) {
  return extensionPath.replace(/^\.?\//, '');
}

function extractScriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => normalizeExtensionPath(match[1]));
}

test('extension manifest declares the Chrome runtime surfaces used by App Connect', () => {
  const manifest = readJson('public/manifest.json');

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'sw.js');
  assert.equal(manifest.options_ui.page, 'options.html');
  assert.deepEqual(manifest.content_scripts, [
    {
      matches: ['<all_urls>'],
      js: ['./c2d/index.js', './content.js'],
      all_frames: true
    }
  ]);
  assert.deepEqual(
    manifest.web_accessible_resources,
    [
      {
        resources: ['/embeddable/*', '/c2d/*'],
        matches: ['<all_urls>']
      }
    ]
  );
  for (const permission of ['storage', 'alarms', 'tabs', 'unlimitedStorage', 'notifications']) {
    assert.ok(manifest.permissions.includes(permission), `missing ${permission} permission`);
  }
  assert.deepEqual(manifest.externally_connectable.matches, [
    'https://appconnect.labs.ringcentral.com/*'
  ]);
});

test('extension package sources provide every manifest and popup runtime entrypoint', () => {
  const manifest = readJson('public/manifest.json');
  const buildJs = readText('build.js');
  const requiredBuildEntrypoints = new Set([
    'src/content.js',
    'src/popup.js',
    'src/sw.js',
    'src/root.jsx'
  ]);

  for (const entrypoint of requiredBuildEntrypoints) {
    assert.ok(buildJs.includes(`'${entrypoint}'`), `build.js must bundle ${entrypoint}`);
    assert.ok(fileExists(entrypoint), `${entrypoint} must exist`);
  }

  assert.ok(fileExists(`public/${manifest.options_ui.page}`), 'options page must exist in public assets');
  assert.ok(fileExists('public/options.js'), 'options page script must exist in public assets');

  for (const script of manifest.content_scripts.flatMap((contentScript) => contentScript.js)) {
    const normalizedScript = normalizeExtensionPath(script);
    if (normalizedScript === 'content.js') {
      assert.ok(requiredBuildEntrypoints.has('src/content.js'));
      continue;
    }
    assert.ok(fileExists(`public/${normalizedScript}`), `${normalizedScript} must exist in public assets`);
  }

  assert.ok(fileExists(`src/${manifest.background.service_worker}`), 'service worker source must exist');

  const popupScripts = extractScriptSources(readText('public/popup.html'));
  assert.deepEqual(popupScripts, ['popup.js', 'embeddable/adapter.js', 'root.js']);
  assert.ok(requiredBuildEntrypoints.has('src/popup.js'));
  assert.ok(requiredBuildEntrypoints.has('src/root.jsx'));
  assert.ok(fileExists('public/embeddable/adapter.js'), 'embeddable adapter must be packaged');

  for (const iconPath of Object.values(manifest.icons)) {
    assert.ok(fileExists(`public/${iconPath}`), `${iconPath} must exist`);
  }
  for (const iconPath of Object.values(manifest.action.default_icon)) {
    assert.ok(fileExists(`public/${iconPath}`), `${iconPath} must exist`);
  }
  for (const resource of manifest.web_accessible_resources.flatMap((entry) => entry.resources)) {
    const resourceRoot = normalizeExtensionPath(resource).replace(/\/\*$/, '');
    assert.ok(fileExists(`public/${resourceRoot}`), `${resourceRoot} resource root must exist`);
  }
});
