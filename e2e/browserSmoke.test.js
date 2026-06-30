const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function getChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);
  const chromePath = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(chromePath, 'Chrome or Edge is required. Set CHROME_PATH to run this E2E smoke test.');
  return chromePath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeChrome(chrome) {
  if (process.platform === 'win32' && chrome.pid) {
    spawnSync('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  } else if (!chrome.killed) {
    chrome.kill();
  }

  if (chrome.exitCode !== null || chrome.signalCode !== null) {
    return;
  }
  await Promise.race([
    new Promise((resolve) => chrome.once('exit', resolve)),
    sleep(1000)
  ]);
}

async function waitForDevToolsPort(profileDir) {
  const activePortFile = path.join(profileDir, 'DevToolsActivePort');
  for (let i = 0; i < 80; i += 1) {
    if (fs.existsSync(activePortFile)) {
      try {
        const [port] = fs.readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
        if (port) {
          return port;
        }
      } catch (error) {
        if (error.code !== 'EBUSY' && error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
    await sleep(100);
  }
  throw new Error('Chrome did not expose a DevTools port.');
}

async function getJson(port, endpoint, init) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, init);
  assert.ok(response.ok, `${endpoint} returned ${response.status}`);
  return response.json();
}

async function waitForExtensionWorker(port) {
  for (let i = 0; i < 80; i += 1) {
    const targets = await getJson(port, '/json/list');
    const worker = targets.find((target) => (
      target.type === 'service_worker'
      && target.url.startsWith('chrome-extension://')
      && target.url.endsWith('/sw.js')
    ));
    if (worker) {
      return worker;
    }
    await sleep(100);
  }
  throw new Error('Extension service worker target was not created.');
}

async function openCdpSession(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  const eventHandlers = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message.id || !pending.has(message.id)) {
      events.push(message);
      const handlers = eventHandlers.get(message.method) || [];
      for (const handler of handlers) {
        Promise.resolve(handler(message)).catch((error) => events.push({ method: 'Codex.eventHandlerError', error: String(error) }));
      }
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message));
      return;
    }
    resolve(message.result);
  });

  return {
    events,
    on(method, handler) {
      const handlers = eventHandlers.get(method) || [];
      handlers.push(handler);
      eventHandlers.set(method, handlers);
    },
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    }
  };
}

async function installFetchMocks(session, routes) {
  await session.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: 'https://appconnect.labs.ringcentral.com/*',
        requestStage: 'Request'
      }
    ]
  });

  session.on('Fetch.requestPaused', async (event) => {
    const { requestId, request } = event.params;
    const route = routes.find((candidate) => candidate.match(request.url, request));
    if (!route) {
      await session.send('Fetch.continueRequest', { requestId });
      return;
    }

    const mockedResponse = typeof route.response === 'function' ? route.response(request) : route.response;
    const responseHeaders = mockedResponse.headers ?? {
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8'
    };
    const responseBody = typeof mockedResponse.body === 'string'
      ? mockedResponse.body
      : JSON.stringify(mockedResponse.body ?? {});
    await session.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: mockedResponse.status ?? 200,
      responseHeaders: Object.entries(responseHeaders).map(([name, value]) => ({
        name,
        value: String(value)
      })),
      body: Buffer.from(responseBody).toString('base64')
    });
  });
}
async function evaluate(session, expression, contextId) {
  const params = {
    expression,
    awaitPromise: true,
    returnByValue: true
  };
  if (contextId) {
    params.contextId = contextId;
  }
  const result = await session.send('Runtime.evaluate', params);
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception;
    throw new Error(exception?.description || exception?.value || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitForPopupReady(session) {
  for (let i = 0; i < 80; i += 1) {
    const result = await evaluate(session, `({
      readyState: document.readyState,
      title: document.title,
      hasReactRoot: !!document.querySelector('#react-container')
    })`);
    if (result.readyState === 'complete' && result.hasReactRoot && result.title) {
      return result;
    }
    await sleep(100);
  }
  throw new Error('Popup page did not finish loading.');
}

async function startCrmTestPage() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html>
        <head><title>CRM Test Page</title></head>
        <body>
          <main>
            <h1>CRM Account</h1>
            <a id="phone-number" href="tel:+15550100">+1 555 0100</a>
          </main>
        </body>
      </html>`);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/crm.html`,
    close() {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseJsonBody(bodyText) {
  if (!bodyText) {
    return undefined;
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
}

const ringCentralWidgetPlatformState = {
  owner_id: 'e2e-owner',
  access_token: 'rc-access-token'
};
async function startAppServer() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type,x-access-token',
      'content-type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
      requests.push({ method: request.method, url: request.url });
      response.writeHead(204, headers);
      response.end();
      return;
    }

    const bodyText = await readRequestBody(request);
    const entry = { method: request.method, url: request.url, headers: request.headers };
    if (bodyText) {
      entry.bodyText = bodyText;
      entry.body = parseJsonBody(bodyText);
    }
    requests.push(entry);
    const requestUrl = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);

    if (request.url.startsWith('/implementedInterfaces')) {
      response.writeHead(200, headers);
      response.end(JSON.stringify({ callLogger: true, messageLogger: true }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/pipedrive-redirect') {
      response.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
        <html>
          <head><title>Pipedrive Redirect</title></head>
          <body>
            <main>
              <h1>Pipedrive setup</h1>
              <div id="rc-stepper">(1/3) Waiting for App Connect.</div>
            </main>
          </body>
        </html>`);
      return;
    }
    if (request.method === 'GET' && request.url.startsWith('/callLog')) {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        logs: [],
        returnMessage: {
          messageType: 'success',
          message: 'No existing call log',
          ttl: 3000
        }
      }));
      return;
    }
    if (request.method === 'POST' && request.url === '/callLog') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        logId: 'server-call-log-1',
        returnMessage: {
          messageType: 'success',
          message: 'Call logged',
          ttl: 3000
        }
      }));
      return;
    }
    if (request.method === 'POST' && request.url === '/messageLog') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        logIds: ['server-message-log-1'],
        returnMessage: {
          messageType: 'success',
          message: 'Message logged',
          ttl: 3000
        }
      }));
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/appointments') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        appointment: {
          id: 'appointment-new',
          thirdPartyAppointmentId: 'appointment-new'
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment created',
          ttl: 3000
        }
      }));
      return;
    }
    if (request.method === 'POST' && /^\/appointments\/[^/]+\/confirm$/.test(requestUrl.pathname)) {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        returnMessage: {
          messageType: 'success',
          message: 'Appointment confirmed',
          ttl: 3000
        }
      }));
      return;
    }
    if (request.method === 'PATCH' && /^\/appointments\/[^/]+$/.test(requestUrl.pathname)) {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        appointment: {
          id: requestUrl.pathname.split('/').pop(),
          ...entry.body
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment updated',
          ttl: 3000
        }
      }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/appointments') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        items: [
          {
            id: 'appointment-1',
            thirdPartyAppointmentId: 'appointment-1',
            title: 'Proposal review',
            startTimeUtc: '2099-07-01T10:00:00.000Z',
            durationMinutes: 30,
            status: 'confirmed',
            attendees: [
              {
                id: 'contact-1',
                name: 'Ada Lovelace',
                type: 'Lead'
              }
            ]
          }
        ]
      }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/oauth-callback') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        jwtToken: 'crm-jwt',
        name: 'Pipedrive User',
        returnMessage: {
          messageType: 'success',
          message: 'CRM authorized',
          ttl: 3000
        }
      }));
      return;
    }    if (request.method === 'GET' && requestUrl.pathname === '/admin/settings') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        userSettings: {}
      }));
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/admin/settings') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true,
        adminSettings: entry.body?.adminSettings
      }));
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/plugin/register') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true
      }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/plugin/oauth/start') {
      const localOrigin = `http://127.0.0.1:${server.address().port}`;
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        authUrl: `${localOrigin}/third-party/oauth/authorize?pluginId=${requestUrl.searchParams.get('pluginId')}`
      }));
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/plugin/logout') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        successful: true
      }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/plugin/licenseStatus') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        licenseStatus: true,
        licenseStatusDescription: 'Active'
      }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/user/settings') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        'plugin_plugin-alpha': {
          value: {
            name: 'acme.alpha',
            version: '1.2.3',
            isAsync: true,
            phase: 'afterLog',
            access: 'public',
            requireLicense: true,
            logTypes: ['call', 'sms'],
            config: {
              apiKey: {
                value: null,
                customizable: true
              },
              secret: {
                value: null,
                customizable: false
              }
            }
          },
          customizable: true
        },
        notificationLevelSetting: {
          value: ['success', 'warning', 'error']
        },
        overridingPhoneNumberFormat: {
          value: 'E.164'
        }
      }));
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/user/settings') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({
        userSettings: entry.body?.userSettings ?? {}
      }));
      return;
    }
    response.writeHead(404, headers);
    response.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    async waitForRequest(predicate) {
      for (let i = 0; i < 80; i += 1) {
        const match = requests.find(predicate);
        if (match) {
          return match;
        }
        await sleep(100);
      }
      throw new Error(`Expected server request was not observed. Requests: ${JSON.stringify(requests)}`);
    },
    async waitForRequestAfter(startIndex, predicate) {
      for (let i = 0; i < 80; i += 1) {
        const match = requests.slice(startIndex).find(predicate);
        if (match) {
          return match;
        }
        await sleep(100);
      }
      throw new Error(`Expected server request after ${startIndex} was not observed. Requests: ${JSON.stringify(requests)}`);
    },    close() {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function seedRingCentralWidgetState(session, rcInfo) {
  await evaluate(session, `(() => new Promise((resolve, reject) => {
    const widgetPlatform = ${JSON.stringify(ringCentralWidgetPlatformState)};
    const rcInfo = ${JSON.stringify(rcInfo)};
    localStorage.setItem('sdk-rc-widgetplatform', JSON.stringify(widgetPlatform));
    const request = indexedDB.open('rc-widget-storage-e2e-owner', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('keyvaluepairs')) {
        db.createObjectStore('keyvaluepairs');
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('keyvaluepairs', 'readwrite');
      tx.objectStore('keyvaluepairs').put(rcInfo, 'dataFetcherV2-storageData');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
    };
  }))()`);
}

async function ensureWidgetPlatformAuth(session) {
  const serializedWidgetPlatform = JSON.stringify(ringCentralWidgetPlatformState);
  await evaluate(session, `(() => {
    const key = 'sdk-rc-widgetplatform';
    const value = ${JSON.stringify(serializedWidgetPlatform)};
    localStorage.setItem(key, value);
    if (window.__APP_CONNECT_E2E_WIDGET_PLATFORM_AUTH__) {
      return true;
    }

    const originalGetItem = Storage.prototype.getItem;
    Object.defineProperty(Storage.prototype, 'getItem', {
      value(keyName) {
        const storedValue = originalGetItem.call(this, keyName);
        if (this === window.localStorage && keyName === key && storedValue == null) {
          return value;
        }
        return storedValue;
      },
      configurable: true,
      writable: true
    });
    window.__APP_CONNECT_E2E_WIDGET_PLATFORM_AUTH__ = true;
    return true;
  })()`);
}

async function waitForChromeStorageApi(session) {
  for (let i = 0; i < 80; i += 1) {
    const ready = await evaluate(session, `typeof chrome !== 'undefined' && !!chrome.storage?.local`);
    if (ready) {
      return true;
    }
    await sleep(100);
  }
  throw new Error('Chrome storage API was not ready.');
}

async function seedExtensionState(port, extensionId, { storage }) {
  const optionsTarget = await getJson(
    port,
    `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/options.html`)}`,
    { method: 'PUT' }
  );
  const optionsSession = await openCdpSession(optionsTarget.webSocketDebuggerUrl);
  try {
    await waitForChromeStorageApi(optionsSession);
    await evaluate(optionsSession, `chrome.storage.local.set(${JSON.stringify(storage)}).then(() => true)`);
  } finally {
    optionsSession.close();
  }
}

async function waitForChromeStorageValue(session, key, predicate) {
  for (let i = 0; i < 80; i += 1) {
    const value = await evaluate(session, `chrome.storage.local.get(${JSON.stringify(key)}).then((items) => items[${JSON.stringify(key)}])`);
    if (predicate(value)) {
      return value;
    }
    await sleep(100);
  }
  throw new Error(`Expected chrome.storage.local[${key}] to satisfy predicate.`);
}

async function waitForAdapterRuntime(session) {
  for (let i = 0; i < 80; i += 1) {
    const state = await evaluate(session, `({
      hasFrame: !!document.querySelector('#rc-widget-adapter-frame')?.contentWindow,
      hasAdapter: typeof RCAdapter !== 'undefined',
      popupScriptReady: window.__ON_RC_POPUP_WINDOW === 1
    })`);
    if (state.hasFrame && state.hasAdapter && state.popupScriptReady) {
      return state;
    }
    await sleep(100);
  }
  throw new Error('Popup adapter runtime was not ready.');
}

async function postWidgetMessage(session, message) {
  await evaluate(session, `(() => {
    const message = ${JSON.stringify(message)};
    window.dispatchEvent(new MessageEvent('message', {
      data: message,
      origin: window.location.origin,
      source: window
    }));
    return true;
  })()`);
}

async function waitForContentScriptInjection(session) {
  for (let i = 0; i < 80; i += 1) {
    const state = await evaluate(session, `({
      readyState: document.readyState,
      hasQuickAccessRoot: !!document.querySelector('#rc-crm-extension-quick-access-button'),
      phoneText: document.querySelector('#phone-number')?.textContent ?? null
    })`);
    if (state.readyState === 'complete' && state.hasQuickAccessRoot) {
      return state;
    }
    await sleep(100);
  }
  throw new Error('Content script did not inject quick access root.');
}

async function waitForExtensionExecutionContext(session, extensionId) {
  await session.send('Runtime.enable');
  for (let i = 0; i < 80; i += 1) {
    const event = session.events.find((candidate) => (
      candidate.method === 'Runtime.executionContextCreated'
      && candidate.params.context.origin === `chrome-extension://${extensionId}`
      && candidate.params.context.auxData?.type === 'isolated'
    ));
    if (event) {
      return event.params.context.id;
    }
    await sleep(100);
  }
  throw new Error('Extension isolated execution context was not created.');
}

async function showC2DCallWidget(session, extensionContextId) {
  await evaluate(session, `(() => {
    const phoneElement = document.querySelector('#phone-number');
    const rect = phoneElement.getBoundingClientRect();
    window.clickToDialInject.widget.setTarget({
      context: { phoneNumber: '+15550100' },
      rect: {
        right: rect.right,
        top: rect.top,
        height: rect.height,
        startLineHeight: rect.height
      }
    });
    return true;
  })()`, extensionContextId);

  for (let i = 0; i < 80; i += 1) {
    const buttonState = await evaluate(session, `(() => {
      const button = document.querySelector('button[title="Call with RingCentral"]');
      const root = button?.parentElement;
      if (!button || !root) {
        return null;
      }
      const rect = button.getBoundingClientRect();
      return {
        rootDisplay: getComputedStyle(root).display,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    })()`);
    if (buttonState?.rootDisplay !== 'none' && buttonState.width > 0 && buttonState.height > 0) {
      return buttonState;
    }
    await sleep(100);
  }
  throw new Error('C2D call button did not become visible.');
}

async function clickCallButton(session, buttonState) {
  const x = buttonState.x + buttonState.width / 2;
  const y = buttonState.y + buttonState.height / 2;
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function waitForExtensionPopupTarget(port, extensionId) {
  for (let i = 0; i < 80; i += 1) {
    const targets = await getJson(port, '/json/list');
    const popupTarget = targets.find((target) => (
      target.type === 'page'
      && target.url.startsWith(`chrome-extension://${extensionId}/popup.html?`)
    ));
    if (popupTarget) {
      return popupTarget;
    }
    await sleep(100);
  }
  throw new Error('C2D intent did not open the extension popup.');
}
async function waitForPageTarget(port, predicate, description) {
  for (let i = 0; i < 80; i += 1) {
    const targets = await getJson(port, '/json/list');
    const target = targets.find((candidate) => candidate.type === 'page' && predicate(candidate));
    if (target) {
      return target;
    }
    await sleep(100);
  }
  throw new Error(`${description} target was not opened.`);
}

test('loads the built extension in Chrome and opens the popup shell', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    assert.match(extensionId, /^[a-p]{32}$/);
    assert.equal(worker.url, `chrome-extension://${extensionId}/sw.js`);

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      const popupState = await waitForPopupReady(session);
      assert.equal(popupState.title, 'RingCentral App Connect - BETA');
      assert.equal(popupState.hasReactRoot, true);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});

test('popup requests implemented interfaces from the configured server manifest', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;
    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme'
            }
          }
        }
      }
    });
    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      const request = await appServer.waitForRequest((entry) => (
        entry.method === 'GET' && entry.url === '/implementedInterfaces?platform=acme'
      ));
      assert.equal(request.method, 'GET');
      assert.equal(request.url, '/implementedInterfaces?platform=acme');
      const storedInterfaces = await waitForChromeStorageValue(session, 'implementedInterfaces', (value) => (
        value?.callLogger === true && value?.messageLogger === true
      ));
      assert.deepEqual(storedInterfaces, { callLogger: true, messageLogger: true });
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('injects quick access into a real CRM test page through the built content script', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const crmPage = await startCrmTestPage();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    await waitForExtensionWorker(port);

    const pageTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(crmPage.url)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(pageTarget.webSocketDebuggerUrl);
    try {
      const pageState = await waitForContentScriptInjection(session);
      assert.equal(pageState.hasQuickAccessRoot, true);
      assert.equal(pageState.phoneText, '+1 555 0100');
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await crmPage.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('sends a C2D call intent from a real CRM test page to the extension popup', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const crmPage = await startCrmTestPage();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    const pageTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(crmPage.url)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(pageTarget.webSocketDebuggerUrl);
    try {
      await waitForContentScriptInjection(session);
      const extensionContextId = await waitForExtensionExecutionContext(session, extensionId);
      const buttonState = await showC2DCallWidget(session, extensionContextId);
      await clickCallButton(session, buttonState);
      const popupTarget = await waitForExtensionPopupTarget(port, extensionId);
      assert.match(popupTarget.url, /popup\.html\?/);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await crmPage.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});

test('handles Pipedrive direct-page callback through content script, service worker, and popup', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  let popupSession;
  let redirectSession;
  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;
    const pipedriveRedirectUrl = `${appServer.origin}/pipedrive-redirect?code=crm-code`;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM'
            },
            pipedrive: {
              name: 'pipedrive',
              displayName: 'Pipedrive',
              useLicense: false,
              auth: {
                type: 'oauth',
                oauth: {
                  redirectUri: `${appServer.origin}/pipedrive-redirect`
                }
              }
            }
          }
        },
        crmAuthed: false,
        userSettings: {
          showUserReportTab: { value: false },
          showCalldownTab: { value: false },
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html?multipleTabsSupport=1&disableLoginPopup=1`)}`,
      { method: 'PUT' }
    );
    popupSession = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    await waitForPopupReady(popupSession);
    await waitForAdapterRuntime(popupSession);
    await seedRingCentralWidgetState(popupSession, {
      value: {
        cachedData: {
          accountInfo: {
            id: 'rc-account-1'
          },
          extensionInfo: {
            extensionNumber: '101',
            id: 'rc-extension-1',
            account: {
              id: 'rc-account-1'
            },
            contact: {
              email: 'ada@example.com'
            },
            permissions: {
              admin: {
                enabled: true
              }
            }
          }
        }
      }
    });
    await ensureWidgetPlatformAuth(popupSession);
    await evaluate(popupSession, `chrome.windows.getCurrent().then((windowInfo) => chrome.storage.local.set({ popupWindowId: windowInfo.id }).then(() => windowInfo.id))`);

    const requestStartIndex = appServer.requests.length;
    const redirectTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(pipedriveRedirectUrl)}`,
      { method: 'PUT' }
    );
    redirectSession = await openCdpSession(redirectTarget.webSocketDebuggerUrl);

    const oauthRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
      const url = new URL(entry.url, appServer.origin);
      return entry.method === 'GET' && url.pathname === '/oauth-callback';
    });
    const oauthUrl = new URL(oauthRequest.url, appServer.origin);
    assert.equal(oauthUrl.searchParams.get('callbackUri'), `${pipedriveRedirectUrl}&state=platform=pipedrive`);
    assert.equal(oauthUrl.searchParams.get('hostname'), 'temp');
    assert.equal(oauthUrl.searchParams.get('rcAccountId'), 'rc-account-1');
    assert.equal(oauthUrl.searchParams.get('rcExtensionId'), 'rc-extension-1');

    const storedJwt = await waitForChromeStorageValue(
      popupSession,
      'rcUnifiedCrmExtJwt',
      (value) => value === 'crm-jwt'
    );
    assert.equal(storedJwt, 'crm-jwt');
    const crmAuthed = await waitForChromeStorageValue(popupSession, 'crmAuthed', (value) => value === true);
    assert.equal(crmAuthed, true);

    for (let i = 0; i < 80; i += 1) {
      const stepperText = await evaluate(redirectSession, `document.querySelector('#rc-stepper')?.textContent ?? ''`);
      if (stepperText.includes('Setup finished')) {
        return;
      }
      await sleep(100);
    }
    throw new Error('Pipedrive setup page did not receive completion notification.');
  } finally {
    popupSession?.close();
    redirectSession?.close();
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('posts a manual call log request with existing contact data from the built popup', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM',
              page: {
                callLog: {
                  additionalFields: [
                    { const: 'caseId' }
                  ]
                },
                newContact: {
                  additionalFields: []
                }
              }
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          overridingPhoneNumberFormat: { value: 'E.164' },
          autoLogCall: { value: false },
          oneTimeLog: { value: false },
          popupLogPageAfterCall: { value: false },
          allowExtensionNumberLogging: { value: false },
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        },
        rcAdditionalSubmission: {
          rcAccountId: 'rc-account-1'
        }
      },
      rcInfo: {
        value: {
          cachedData: {
            extensionInfo: {
              extensionNumber: '101',
              id: 'rc-extension-1',
              account: {
                id: 'rc-account-1'
              },
              contact: {
                email: 'ada@example.com'
              },
              permissions: {
                admin: {
                  enabled: false
                }
              }
            }
          }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);
      await seedRingCentralWidgetState(session, {
        value: {
          cachedData: {
            extensionInfo: {
              extensionNumber: '101',
              id: 'rc-extension-1',
              account: {
                id: 'rc-account-1'
              },
              contact: {
                email: 'ada@example.com'
              },
              permissions: {
                admin: {
                  enabled: false
                }
              }
            }
          }
        }
      });
      await ensureWidgetPlatformAuth(session);

      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/callLogger',
        requestId: 'call-log-e2e-1',
        body: {
          triggerType: 'logForm',
          call: {
            sessionId: 'call-session-1',
            telephonySessionId: 'telephony-session-1',
            direction: 'Inbound',
            result: 'Accepted',
            startTime: '2026-06-30T01:02:03.000Z',
            duration: 125,
            from: {
              phoneNumber: '+15550100'
            },
            to: {
              phoneNumber: '+15550199'
            }
          },
          formData: {
            triggerType: 'createLog',
            contact: 'contact-1',
            contactType: 'Lead',
            contactName: 'Ada Lovelace',
            newContactName: '',
            newContactType: '',
            activityTitle: 'Inbound call from Ada',
            note: 'Customer asked for follow up',
            caseId: 'case-42',
            scheduleCallback: false
          },
          aiNote: 'AI call summary',
          transcript: 'Call transcript text'
        }
      });

      const callLogRequest = await appServer.waitForRequest((entry) => (
        entry.method === 'POST' && entry.url === '/callLog'
      ));
      assert.equal(callLogRequest.headers.authorization, 'Bearer crm-jwt');
      assert.equal(callLogRequest.body.contactId, 'contact-1');
      assert.equal(callLogRequest.body.contactType, 'Lead');
      assert.equal(callLogRequest.body.contactName, 'Ada Lovelace');
      assert.equal(callLogRequest.body.note, 'Customer asked for follow up');
      assert.equal(callLogRequest.body.aiNote, 'AI call summary');
      assert.equal(callLogRequest.body.transcript, 'Call transcript text');
      assert.deepEqual(callLogRequest.body.additionalSubmission, {
        caseId: 'case-42',
        rcAccountId: 'rc-account-1'
      });
      assert.deepEqual(callLogRequest.body.overridingFormat, ['E.164']);
      assert.equal(callLogRequest.body.extensionNumber, '101');
      assert.deepEqual(callLogRequest.body.logInfo, {
        sessionId: 'call-session-1',
        telephonySessionId: 'telephony-session-1',
        direction: 'Inbound',
        result: 'Accepted',
        startTime: '2026-06-30T01:02:03.000Z',
        duration: 125,
        from: {
          phoneNumber: '+15550100'
        },
        to: {
          phoneNumber: '+15550199'
        },
        customSubject: 'Inbound call from Ada'
      });
      assert.equal(appServer.requests.some((entry) => (
        entry.method === 'POST' && entry.url.includes('/contacts')
      )), false);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});

test('posts a manual message log request with existing contact data from the built popup', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM',
              page: {
                messageLog: {
                  additionalFields: [
                    { const: 'caseId' }
                  ]
                },
                newContact: {
                  additionalFields: []
                }
              }
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          overridingPhoneNumberFormat: { value: 'E.164' },
          popupLogPageAfterSMS: { value: false },
          autoLogSMS: { value: false },
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        },
        rcAdditionalSubmission: {
          rcAccountId: 'rc-account-1'
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);
      await ensureWidgetPlatformAuth(session);

      const conversation = {
        conversationId: 'conversation-1',
        conversationLogId: 'message-log-1',
        type: 'SMS',
        correspondents: [
          {
            phoneNumber: '+15550100',
            name: 'Ada Lovelace'
          }
        ],
        messages: [
          {
            id: 'message-1',
            type: 'SMS',
            direction: 'Inbound',
            from: {
              phoneNumber: '+15550100'
            },
            to: [
              {
                phoneNumber: '+15550199'
              }
            ],
            text: 'Could you send the proposal?',
            creationTime: '2026-06-30T02:03:04.000Z',
            attachments: []
          }
        ]
      };

      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/messageLogger',
        requestId: 'message-log-e2e-1',
        body: {
          triggerType: 'logForm',
          conversation,
          formData: {
            triggerType: 'createLog',
            contact: 'contact-1',
            contactType: 'Lead',
            contactName: 'Ada Lovelace',
            newContactName: '',
            newContactType: '',
            caseId: 'case-42'
          }
        }
      });

      const messageLogRequest = await appServer.waitForRequest((entry) => (
        entry.method === 'POST' && entry.url === '/messageLog'
      ));
      assert.equal(messageLogRequest.headers.authorization, 'Bearer crm-jwt');
      assert.equal(messageLogRequest.body.contactId, 'contact-1');
      assert.equal(messageLogRequest.body.contactType, 'Lead');
      assert.equal(messageLogRequest.body.contactName, 'Ada Lovelace');
      assert.deepEqual(messageLogRequest.body.additionalSubmission, {
        caseId: 'case-42',
        rcAccountId: 'rc-account-1'
      });
      assert.deepEqual(messageLogRequest.body.overridingFormat, ['E.164']);
      assert.deepEqual(messageLogRequest.body.logInfo, conversation);
      const storedLog = await waitForChromeStorageValue(
        session,
        'rc-crm-conversation-log-message-log-1',
        (value) => value?.logged === true
      );
      assert.deepEqual(storedLog, { logged: true });
      assert.equal(appServer.requests.some((entry) => (
        entry.method === 'POST' && entry.url.includes('/contacts')
      )), false);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('confirms an appointment from the built popup and refreshes the appointments list', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM',
              page: {
                appointment: {
                  supported: true,
                  title: 'Appointments',
                  showConfirm: true,
                  filterStatus: {
                    value: ['All', 'Scheduled', 'Canceled']
                  }
                }
              }
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          showAppointmentsTab: { value: true },
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);

      const requestStartIndex = appServer.requests.length;
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'appointment-confirm-e2e-1',
        body: {
          button: {
            id: 'appointmentConfirm-appointment-1-action',
            type: 'button',
            page: {
              formData: {
                tab: 'upcoming',
                searchWithFilters: {
                  search: 'Ada',
                  filter: 'All'
                }
              }
            }
          }
        }
      });

      const confirmRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/appointments/appointment-1/confirm';
      });
      const confirmUrl = new URL(confirmRequest.url, appServer.origin);
      assert.equal(confirmUrl.searchParams.get('jwtToken'), 'crm-jwt');
      assert.equal(confirmRequest.headers.authorization, 'Bearer crm-jwt');

      const listRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'GET' && url.pathname === '/appointments';
      });
      const listUrl = new URL(listRequest.url, appServer.origin);
      assert.equal(listUrl.searchParams.get('jwtToken'), 'crm-jwt');
      assert.equal(listUrl.searchParams.get('range'), 'upcoming');
      assert.equal(listUrl.searchParams.get('mineOnly'), 'false');
      assert.equal(listUrl.searchParams.get('forceSync'), 'false');
      assert.equal(appServer.requests.slice(requestStartIndex).some((entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/appointments/appointment-1/status';
      }), false);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('creates an appointment from the built popup and refreshes the return list', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM',
              page: {
                appointment: {
                  supported: true,
                  title: 'Appointments',
                  showConfirm: true,
                  filterStatus: {
                    value: ['All', 'Scheduled', 'Canceled']
                  },
                  titleField: {
                    isVisible: true,
                    value: 'Title'
                  }
                }
              }
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          showAppointmentsTab: { value: true },
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);

      const requestStartIndex = appServer.requests.length;
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'appointment-create-e2e-1',
        body: {
          button: {
            id: 'appointmentCreatePage',
            type: 'submit',
            formData: {
              title: 'Architecture review',
              dateTime: '2099-07-01T10:00:00.000Z',
              endDateTime: '2099-07-01T10:45:00.000Z',
              duration: 'PT45M',
              summary: 'Review integration design.',
              status: 'scheduled',
              participantContactIds: ['contact-2'],
              participantContactId: 'contact-2',
              participantContactType: 'Contact',
              participantCandidates: [
                {
                  id: 'contact-2',
                  type: 'Contact',
                  name: 'Grace Hopper',
                  email: 'grace@example.com'
                }
              ],
              returnTab: 'upcoming',
              returnSearch: 'Grace',
              returnFilter: 'Scheduled'
            }
          }
        }
      });

      const createRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/appointments';
      });
      const createUrl = new URL(createRequest.url, appServer.origin);
      assert.equal(createUrl.searchParams.get('jwtToken'), 'crm-jwt');
      assert.equal(createRequest.headers.authorization, 'Bearer crm-jwt');
      assert.deepEqual(createRequest.body, {
        participantName: 'Grace Hopper',
        contactId: 'contact-2',
        contactType: 'Contact',
        contacts: [
          {
            id: 'contact-2',
            type: 'Contact',
            name: 'Grace Hopper',
            email: 'grace@example.com'
          }
        ],
        summary: 'Review integration design.',
        startTimeUtc: '2099-07-01T10:00:00.000Z',
        durationMinutes: 45,
        status: 'scheduled',
        title: 'Architecture review'
      });

      const listRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'GET' && url.pathname === '/appointments';
      });
      const listUrl = new URL(listRequest.url, appServer.origin);
      assert.equal(listUrl.searchParams.get('jwtToken'), 'crm-jwt');
      assert.equal(listUrl.searchParams.get('range'), 'upcoming');
      assert.equal(listUrl.searchParams.get('mineOnly'), 'false');
      assert.equal(listUrl.searchParams.get('forceSync'), 'true');
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('updates an appointment from the built popup and refreshes the return list', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM',
              page: {
                appointment: {
                  supported: true,
                  title: 'Appointments',
                  showConfirm: true,
                  filterStatus: {
                    value: ['All', 'Scheduled', 'Confirmed', 'Canceled']
                  },
                  titleField: {
                    isVisible: true,
                    value: 'Title'
                  }
                }
              }
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          showAppointmentsTab: { value: true },
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);

      const requestStartIndex = appServer.requests.length;
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'appointment-edit-e2e-1',
        body: {
          button: {
            id: 'appointmentEditPage',
            type: 'submit',
            formData: {
              thirdPartyAppointmentId: 'appointment-1',
              title: 'Updated proposal review',
              dateTime: '2099-07-01T11:00:00.000Z',
              endDateTime: '2099-07-01T11:30:00.000Z',
              duration: 'PT30M',
              summary: 'Updated proposal notes.',
              status: 'confirmed',
              participantContactIds: ['contact-1'],
              participantContactId: 'contact-1',
              participantContactType: 'Lead',
              participantCandidates: [
                {
                  id: 'contact-1',
                  type: 'Lead',
                  name: 'Ada Lovelace'
                }
              ],
              returnTab: 'upcoming',
              returnSearch: 'Ada',
              returnFilter: 'All'
            }
          }
        }
      });

      const patchRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'PATCH' && url.pathname === '/appointments/appointment-1';
      });
      const patchUrl = new URL(patchRequest.url, appServer.origin);
      assert.equal(patchUrl.searchParams.get('jwtToken'), 'crm-jwt');
      assert.equal(patchRequest.headers.authorization, 'Bearer crm-jwt');
      assert.deepEqual(patchRequest.body, {
        participantName: 'Ada Lovelace',
        summary: 'Updated proposal notes.',
        startTime: '2099-07-01T11:00:00.000Z',
        durationMinutes: 30,
        contactId: 'contact-1',
        contactType: 'Lead',
        contacts: [
          {
            id: 'contact-1',
            type: 'Lead',
            name: 'Ada Lovelace'
          }
        ],
        attendees: [
          {
            id: 'contact-1',
            type: 'Lead',
            name: 'Ada Lovelace'
          }
        ],
        attendeeIds: ['contact-1'],
        title: 'Updated proposal review',
        status: 'confirmed'
      });

      const listRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'GET' && url.pathname === '/appointments';
      });
      const listUrl = new URL(listRequest.url, appServer.origin);
      assert.equal(listUrl.searchParams.get('jwtToken'), 'crm-jwt');
      assert.equal(listUrl.searchParams.get('range'), 'upcoming');
      assert.equal(listUrl.searchParams.get('mineOnly'), 'false');
      assert.equal(listUrl.searchParams.get('forceSync'), 'false');
      assert.equal(appServer.requests.slice(requestStartIndex).some((entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/appointments/appointment-1/status';
      }), false);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('installs an admin plugin from the built popup and registers it with the server', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  const pluginAlpha = {
    id: 'plugin-alpha',
    access: 'public',
    name: 'acme.alpha',
    displayName: 'Acme Alpha',
    version: '1.2.3',
    isAsync: true,
    phase: 'afterLog',
    supportedLogTypes: ['call', 'sms'],
    requireLicense: true,
    description: 'Alpha plugin',
    developer: {
      name: 'Acme'
    },
    pageContent: [
      {
        const: 'apiKey',
        title: 'API Key',
        type: 'string'
      },
      {
        const: 'secret',
        title: 'Secret',
        type: 'string',
        hidden: true
      }
    ]
  };
  const pluginBeta = {
    ...pluginAlpha,
    id: 'plugin-beta',
    name: 'acme.beta',
    displayName: 'Acme Beta',
    requireLicense: false
  };

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM'
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        rcUserInfo: {
          rcAccountId: 'rc-account-1'
        },
        userSettings: {
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await installFetchMocks(session, [
        {
          match: (url) => {
            const parsed = new URL(url);
            return parsed.pathname === '/public-api/connectors' && parsed.searchParams.get('type') === 'plugin';
          },
          response: {
            body: {
              connectors: [pluginAlpha, pluginBeta]
            }
          }
        },
        {
          match: (url) => {
            const parsed = new URL(url);
            return parsed.pathname === '/public-api/connectors/internal'
              && parsed.searchParams.get('access') === 'internal'
              && parsed.searchParams.get('type') === 'plugin'
              && parsed.searchParams.get('accountId') === 'rc-account-1';
          },
          response: {
            body: {
              sharedConnectors: [],
              privateConnectors: []
            }
          }
        }
      ]);
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);
      await seedRingCentralWidgetState(session, {
        value: {
          cachedData: {
            accountInfo: {
              id: 'rc-account-1'
            },
            extensionInfo: {
              extensionNumber: '101',
              id: 'rc-extension-1',
              account: {
                id: 'rc-account-1'
              },
              contact: {
                email: 'ada@example.com'
              },
              permissions: {
                admin: {
                  enabled: true
                }
              }
            }
          }
        }
      });
      await ensureWidgetPlatformAuth(session);

      const requestStartIndex = appServer.requests.length;
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'plugin-install-e2e-1',
        body: {
          button: {
            id: 'installButton',
            type: 'button',
            formData: {
              isFromAdmin: true,
              pluginId: 'plugin-alpha',
              access: 'public',
              plugin: pluginAlpha
            }
          }
        }
      });

      const adminUploadRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/admin/settings';
      });
      assert.equal(new URL(adminUploadRequest.url, appServer.origin).searchParams.get('rcAccessToken'), 'rc-access-token');
      assert.equal(adminUploadRequest.headers.authorization, 'Bearer crm-jwt');
      assert.deepEqual(adminUploadRequest.body.adminSettings.userSettings['plugin_plugin-alpha'], {
        value: {
          name: 'acme.alpha',
          version: '1.2.3',
          isAsync: true,
          logTypes: ['call', 'sms'],
          access: 'public',
          requireLicense: true,
          config: {
            apiKey: {
              value: null,
              customizable: true
            },
            secret: {
              value: null,
              customizable: false
            }
          }
        },
        customizable: true
      });

      const registerRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/plugin/register';
      });
      const registerUrl = new URL(registerRequest.url, appServer.origin);
      assert.equal(registerUrl.searchParams.get('rcAccessToken'), 'rc-access-token');
      assert.equal(registerRequest.headers.authorization, 'Bearer crm-jwt');
      assert.deepEqual(registerRequest.body, {
        pluginId: 'plugin-alpha',
        pluginAccess: 'public',
        pluginName: 'acme.alpha',
        rcAccountId: 'rc-account-1'
      });
      assert.equal(appServer.requests.slice(requestStartIndex).some((entry) => (
        entry.method === 'POST'
        && new URL(entry.url, appServer.origin).pathname === '/admin/settings'
        && entry.body?.adminSettings?.userSettings?.['plugin_plugin-alpha']?.isRemoved === true
      )), false);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('opens plugin OAuth from the built popup and caches the current config form', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  const pluginAlpha = {
    id: 'plugin-alpha',
    access: 'public',
    name: 'acme.alpha',
    displayName: 'Acme Alpha',
    version: '1.2.3',
    authorizationUrl: `${appServer.origin}/plugin/oauth/start`,
    pageContent: [
      {
        const: 'apiKey',
        title: 'API Key',
        type: 'string'
      }
    ]
  };

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM'
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);

      const requestStartIndex = appServer.requests.length;
      const formData = {
        isFromAdmin: false,
        access: 'public',
        pluginId: 'plugin-alpha',
        plugin: pluginAlpha,
        existingConfig: {
          apiKey: {
            value: 'old-key',
            customizable: true
          }
        },
        config: {
          apiKey: 'draft-key'
        }
      };
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'plugin-auth-e2e-1',
        body: {
          button: {
            id: 'pluginAuthButton',
            type: 'button',
            formData
          }
        }
      });

      const authRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'GET' && url.pathname === '/plugin/oauth/start';
      });
      const authUrl = new URL(authRequest.url, appServer.origin);
      assert.equal(authUrl.searchParams.get('pluginId'), 'plugin-alpha');

      const oauthTarget = await waitForPageTarget(
        port,
        (target) => target.url.startsWith(`${appServer.origin}/third-party/oauth/authorize?pluginId=plugin-alpha`),
        'Plugin OAuth'
      );
      assert.equal(new URL(oauthTarget.url).searchParams.get('pluginId'), 'plugin-alpha');

      const cachedFormData = await waitForChromeStorageValue(
        session,
        'cachedPluginConfigFormData',
        (value) => value?.pluginId === 'plugin-alpha'
      );
      assert.deepEqual(cachedFormData, formData);
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('logs out plugin from the built popup and refreshes license status', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  const pluginAlpha = {
    id: 'plugin-alpha',
    access: 'public',
    name: 'acme.alpha',
    displayName: 'Acme Alpha',
    version: '1.2.3',
    isAsync: true,
    phase: 'afterLog',
    supportedLogTypes: ['call', 'sms'],
    requireLicense: true,
    showAuthorizationButton: true,
    logoutUrl: `${appServer.origin}/plugin/logout`,
    description: 'Alpha plugin',
    pageContent: [
      {
        const: 'apiKey',
        title: 'API Key',
        type: 'string'
      }
    ]
  };

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM'
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        userSettings: {
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);
      await seedRingCentralWidgetState(session, {
        value: {
          cachedData: {
            accountInfo: {
              id: 'rc-account-1'
            },
            extensionInfo: {
              extensionNumber: '101',
              id: 'rc-extension-1',
              account: {
                id: 'rc-account-1'
              },
              contact: {
                email: 'ada@example.com'
              },
              permissions: {
                admin: {
                  enabled: true
                }
              }
            }
          }
        }
      });
      await ensureWidgetPlatformAuth(session);

      const requestStartIndex = appServer.requests.length;
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'plugin-logout-e2e-1',
        body: {
          button: {
            id: 'pluginLogoutButton',
            type: 'button',
            formData: {
              isFromAdmin: false,
              access: 'public',
              pluginId: 'plugin-alpha',
              plugin: pluginAlpha,
              isAsync: true,
              phase: 'afterLog',
              logTypes: ['call', 'sms'],
              existingConfig: {
                apiKey: {
                  value: 'stored-key',
                  customizable: true
                },
                secret: {
                  value: 'stored-secret',
                  customizable: false
                }
              },
              config: {
                apiKey: 'draft-key'
              }
            }
          }
        }
      });

      const logoutRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/plugin/logout';
      });
      assert.deepEqual(logoutRequest.body, {
        jwtToken: 'crm-jwt'
      });

      const licenseStatusRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'GET' && url.pathname === '/plugin/licenseStatus';
      });
      const licenseStatusUrl = new URL(licenseStatusRequest.url, appServer.origin);
      assert.equal(licenseStatusRequest.headers.authorization, 'Bearer crm-jwt');
      assert.equal(licenseStatusUrl.searchParams.get('rcAccountId'), 'rc-account-1');
      assert.equal(licenseStatusUrl.searchParams.get('pluginId'), 'plugin-alpha');
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
test('submits plugin configuration from the built popup with page-generated logTypes', async () => {
  const chromePath = getChromePath();
  const extensionDir = path.join(repoRoot, 'dist');
  assert.ok(fs.existsSync(path.join(extensionDir, 'manifest.json')), 'Run npm run build before npm run test:e2e.');

  const appServer = await startAppServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-e2e-'));
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--headless=new',
    'about:blank'
  ], { stdio: 'ignore' });

  const pluginAlpha = {
    id: 'plugin-alpha',
    access: 'public',
    name: 'acme.alpha',
    displayName: 'Acme Alpha',
    version: '1.2.3',
    isAsync: true,
    phase: 'afterLog',
    supportedLogTypes: ['call', 'sms'],
    requireLicense: false,
    description: 'Alpha plugin',
    pageContent: [
      {
        const: 'apiKey',
        title: 'API Key',
        type: 'string'
      }
    ]
  };

  try {
    const port = await waitForDevToolsPort(profileDir);
    const worker = await waitForExtensionWorker(port);
    const extensionId = new URL(worker.url).hostname;

    await seedExtensionState(port, extensionId, {
      storage: {
        'platform-info': {
          platformName: 'acme',
          hostname: 'tenant.example.com'
        },
        customCrmManifest: {
          serverUrl: appServer.origin,
          platforms: {
            acme: {
              name: 'acme',
              displayName: 'Acme CRM'
            }
          }
        },
        rcUnifiedCrmExtJwt: 'crm-jwt',
        crmAuthed: true,
        rcUserInfo: {
          rcAccountId: 'rc-account-1'
        },
        userSettings: {
          notificationLevelSetting: { value: ['success', 'warning', 'error'] }
        }
      }
    });

    const popupTarget = await getJson(
      port,
      `/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/popup.html`)}`,
      { method: 'PUT' }
    );
    const session = await openCdpSession(popupTarget.webSocketDebuggerUrl);
    try {
      await waitForPopupReady(session);
      await waitForAdapterRuntime(session);
      await seedRingCentralWidgetState(session, {
        value: {
          cachedData: {
            accountInfo: {
              id: 'rc-account-1'
            },
            extensionInfo: {
              extensionNumber: '101',
              id: 'rc-extension-1',
              account: {
                id: 'rc-account-1'
              },
              contact: {
                email: 'ada@example.com'
              },
              permissions: {
                admin: {
                  enabled: true
                }
              }
            }
          }
        }
      });
      await ensureWidgetPlatformAuth(session);

      const requestStartIndex = appServer.requests.length;
      await postWidgetMessage(session, {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'plugin-config-submit-e2e-1',
        body: {
          button: {
            id: 'pluginConfigurePage',
            type: 'submit',
            formData: {
              isFromAdmin: false,
              access: 'public',
              pluginId: 'plugin-alpha',
              plugin: pluginAlpha,
              isAsync: true,
              phase: 'afterLog',
              logTypes: ['call', 'sms'],
              existingConfig: {
                apiKey: {
                  value: 'old-key',
                  customizable: true
                },
                secret: {
                  value: 'stored-secret',
                  customizable: false
                }
              },
              config: {
                apiKey: 'new-key'
              }
            }
          }
        }
      });

      const settingsRequest = await appServer.waitForRequestAfter(requestStartIndex, (entry) => {
        const url = new URL(entry.url, appServer.origin);
        return entry.method === 'POST' && url.pathname === '/user/settings';
      });
      assert.equal(settingsRequest.headers.authorization, 'Bearer crm-jwt');
      assert.deepEqual(settingsRequest.body.settingKeysToRemove, []);
      assert.deepEqual(settingsRequest.body.userSettings['plugin_plugin-alpha'], {
        value: {
          name: 'acme.alpha',
          version: '1.2.3',
          isAsync: true,
          phase: 'afterLog',
          access: 'public',
          supportedLogTypes: ['call', 'sms'],
          rcAccountId: 'rc-account-1',
          config: {
            apiKey: {
              value: 'new-key',
              customizable: true
            },
            secret: {
              value: 'stored-secret',
              customizable: false
            }
          }
        },
        customizable: true
      });
    } finally {
      session.close();
    }
  } finally {
    await closeChrome(chrome);
    await appServer.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
