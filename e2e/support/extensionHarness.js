const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..', '..', 'dist');
const defaultChromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function getBrowserLaunchTarget() {
  if (process.env.E2E_BROWSER_CHANNEL) {
    return { channel: process.env.E2E_BROWSER_CHANNEL };
  }
  if (process.env.E2E_CHROME_PATH) {
    return { executablePath: process.env.E2E_CHROME_PATH };
  }
  const executablePath = defaultChromePaths.find((candidate) => fs.existsSync(candidate));
  if (executablePath) {
    return { executablePath };
  }
  return { channel: 'chromium' };
}

async function assertBuiltExtension() {
  try {
    await fsp.access(path.join(extensionPath, 'manifest.json'));
    await fsp.access(path.join(extensionPath, 'content.js'));
    await fsp.access(path.join(extensionPath, 'sw.js'));
  } catch (error) {
    throw new Error('Built extension not found. Run `npm run build` before Playwright E2E.');
  }
}

async function launchExtensionContext() {
  await assertBuiltExtension();
  const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...getBrowserLaunchTarget(),
    headless: process.env.E2E_HEADLESS === '1',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (
      url.startsWith('chrome-extension://') ||
      url.startsWith('http://127.0.0.1:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return route.continue();
    }
    return route.abort();
  });

  let serviceWorker = context.serviceWorkers().find((worker) => worker.url().endsWith('/sw.js'));
  while (!serviceWorker) {
    const candidate = await context.waitForEvent('serviceworker');
    if (candidate.url().endsWith('/sw.js')) {
      serviceWorker = candidate;
    }
  }
  const extensionId = new URL(serviceWorker.url()).host;

  return {
    context,
    extensionId,
    serviceWorker,
    async close() {
      await context.close();
      await fsp.rm(userDataDir, { recursive: true, force: true });
    },
  };
}

async function seedExtensionStorage(extension, seed) {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
  await page.evaluate(async (storageSeed) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(storageSeed);
  }, seed);
  await page.close();
}

async function readExtensionStorage(extension, keys) {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
  const storage = await page.evaluate(async (storageKeys) => chrome.storage.local.get(storageKeys), keys);
  await page.close();
  return storage;
}

async function sendExtensionMessage(extension, message) {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
  const response = await page.evaluate(async (payload) => chrome.runtime.sendMessage(payload), message);
  await page.close();
  return response;
}

module.exports = {
  launchExtensionContext,
  readExtensionStorage,
  sendExtensionMessage,
  seedExtensionStorage,
};
