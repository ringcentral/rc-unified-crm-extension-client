const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}


function projectRecord(record, attributes) {
  if (!attributes) {
    return { ...record };
  }
  const projected = {};
  for (const attribute of attributes) {
    if (Object.prototype.hasOwnProperty.call(record, attribute)) {
      projected[attribute] = record[attribute];
    }
  }
  return projected;
}

function createQuery(records, calls, initialField) {
  const filters = [];
  const state = {
    field: initialField,
    negateNext: false,
    attributes: null,
    limit: undefined,
  };
  const query = {
    eq(value) {
      filters.push({ field: state.field, value, negate: state.negateNext });
      calls.push({ method: 'eq', field: state.field, value, negate: state.negateNext });
      state.negateNext = false;
      return query;
    },
    where(field) {
      state.field = field;
      calls.push({ method: 'where', field });
      return query;
    },
    not() {
      state.negateNext = true;
      calls.push({ method: 'not' });
      return query;
    },
    contains(value) {
      filters.push({ field: state.field, value, contains: true });
      calls.push({ method: 'contains', field: state.field, value });
      return query;
    },
    attributes(attributes) {
      state.attributes = attributes;
      calls.push({ method: 'attributes', attributes });
      return query;
    },
    limit(limit) {
      state.limit = limit;
      calls.push({ method: 'limit', limit });
      return query;
    },
    startAt(key) {
      calls.push({ method: 'startAt', key });
      return query;
    },
    async exec() {
      let rows = records.filter((record) => filters.every((filter) => {
        if (filter.contains) {
          return String(record[filter.field] ?? '').includes(filter.value);
        }
        const matches = record[filter.field] === filter.value;
        return filter.negate ? !matches : matches;
      }));
      if (typeof state.limit === 'number') {
        rows = rows.slice(0, state.limit);
      }
      return rows.map((record) => projectRecord(record, state.attributes));
    },
  };
  return query;
}
function stubModule(modulePath, exportsValue, restoreEntries) {
  const resolvedPath = require.resolve(modulePath);
  restoreEntries.push([
    resolvedPath,
    Object.prototype.hasOwnProperty.call(require.cache, resolvedPath)
      ? require.cache[resolvedPath]
      : undefined,
  ]);
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: exportsValue,
  };
}

function loadDeveloperConsoleConnectorRouter({ Connector, Cache = {} }, t) {
  const appRoot = path.resolve(__dirname, '../../../app-connect-developer-console/app');
  const routerPath = path.join(appRoot, 'routers/connector.js');
  const restoreEntries = [];

  stubModule(path.join(appRoot, 'models/connector.js'), { Connector }, restoreEntries);
  stubModule(path.join(appRoot, 'models/user.js'), { User: {} }, restoreEntries);
  stubModule(path.join(appRoot, 'models/cache.js'), { Cache }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/ringcentral.js'), { RingCentral: class {} }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/CustomerIO.js'), { CustomerIO: class {} }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/checkAndRefreshUserToken.js'), { checkAndRefreshUserToken: async () => true }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/logging.js'), { Logger: class {} }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/encode.js'), { encode: (value) => value, decode: (value) => value }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/isValidManifest.js'), { isValidManifest: () => [], anyImportantFieldsChanged: () => false }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/validateProxyConfig.js'), { validateProxyConfig: () => [], anyImportantProxyFieldsChanged: () => false }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/allowedAccountCache.js'), {
    addAllowedAccountToCache: async () => {},
    removeAllowedAccountFromCache: async () => {},
    cleanupReviewingAdminCaches: async () => {},
  }, restoreEntries);
  stubModule(path.join(appRoot, 'lib/constants.js'), {
    CONNECTOR_STATUS: {
      APPROVED: 'approved',
      PRIVATE: 'private',
      UNDER_REVIEW: 'under_review',
      REJECTED: 'rejected',
    },
    RINGCENTRAL_OPTIONS: {},
  }, restoreEntries);

  const resolvedRouterPath = require.resolve(routerPath);
  restoreEntries.push([
    resolvedRouterPath,
    Object.prototype.hasOwnProperty.call(require.cache, resolvedRouterPath)
      ? require.cache[resolvedRouterPath]
      : undefined,
  ]);
  delete require.cache[resolvedRouterPath];

  t.after(() => {
    for (const [resolvedPath, originalEntry] of restoreEntries.reverse()) {
      if (originalEntry) {
        require.cache[resolvedPath] = originalEntry;
      } else {
        delete require.cache[resolvedPath];
      }
    }
  });

  return require(routerPath);
}

test('Developer Console public plugin manifest contract exposes plugin details for client getPluginDetails', async (t) => {
  const pluginManifest = {
    name: 'contract.plugin',
    displayName: 'Contract Plugin',
    version: '2.1.0',
    endpointUrl: 'https://plugin.example.com/webhook',
    supportedLogTypes: ['call', 'message'],
    phase: 'pre',
    isAsync: true,
    requireLicense: true,
    licenseStatusUrl: 'https://plugin.example.com/license',
    pageContent: [
      {
        const: 'folderId',
        title: 'Folder ID',
        type: 'string',
        required: true,
      },
    ],
  };
  const connectorLookups = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Connector: {
      async get(key) {
        connectorLookups.push(key);
        assert.deepEqual(key, {
          id: 'contract-plugin-public',
          accountId: 'approved',
        });
        return {
          id: 'contract-plugin-public',
          name: 'contract.plugin',
          type: 'plugin',
          status: 'approved',
          manifest: pluginManifest,
          developer: {
            name: 'Plugin Dev',
            websiteUrl: 'https://plugin.example.com',
          },
        };
      },
    },
  }, t);

  const res = createResponse();

  await connectorRouter.getManifest(
    {
      params: {
        id: 'contract-plugin-public',
      },
      query: {
        type: 'plugin',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(connectorLookups, [
    {
      id: 'contract-plugin-public',
      accountId: 'approved',
    },
  ]);
  assert.deepEqual(res.body, {
    serverUrl: undefined,
    redirectUri: undefined,
    author: {
      name: 'Plugin Dev',
      websiteUrl: 'https://plugin.example.com',
    },
    version: '2.1.0',
    platforms: {
      'contract.plugin': pluginManifest,
    },
  });
});

test('Developer Console internal plugin manifest contract uses requested account and preserves plugin fields', async (t) => {
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Connector: {
      async get(key) {
        assert.deepEqual(key, {
          id: 'contract-plugin-internal',
          accountId: 'acc-2',
        });
        return {
          id: 'contract-plugin-internal',
          name: 'contract.plugin.internal',
          type: 'plugin',
          status: 'private',
          developer: {
            name: 'Internal Plugin Dev',
          },
          manifest: {
            name: 'contract.plugin.internal',
            displayName: 'Internal Contract Plugin',
            version: '3.0.0',
            endpointUrl: 'https://plugin.example.com/internal-webhook',
            supportedLogTypes: ['call'],
            phase: 'post',
            isAsync: false,
            pageContent: [],
          },
        };
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getManifest(
    {
      params: {
        id: 'contract-plugin-internal',
      },
      query: {
        access: 'internal',
        type: 'plugin',
        accountId: 'acc-2',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.author.name, 'Internal Plugin Dev');
  assert.equal(res.body.version, '3.0.0');
  assert.deepEqual(res.body.platforms['contract.plugin.internal'], {
    name: 'contract.plugin.internal',
    displayName: 'Internal Contract Plugin',
    version: '3.0.0',
    endpointUrl: 'https://plugin.example.com/internal-webhook',
    supportedLogTypes: ['call'],
    phase: 'post',
    isAsync: false,
    pageContent: [],
  });
});
test('Developer Console public plugin catalog contract returns approved plugins for client getPluginList', async (t) => {
  const queryCalls = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Connector: {
      query(field) {
        assert.equal(field, 'accountId');
        return createQuery([
          {
            id: 'public-plugin',
            accountId: 'approved',
            name: 'public.plugin',
            type: 'plugin',
            displayName: 'Public Plugin',
            iconUrl: 'https://plugin.example.com/icon.svg',
            status: 'approved',
            developer: { name: 'Plugin Dev' },
            version: '1.2.3',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          },
          {
            id: 'public-connector',
            accountId: 'approved',
            name: 'public.crm',
            type: 'connector',
            displayName: 'Public CRM',
            status: 'approved',
          },
        ], queryCalls, field);
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getApprovedConnectors(
    {
      query: {
        type: 'plugin',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.connectors, [
    {
      id: 'public-plugin',
      name: 'public.plugin',
      type: 'plugin',
      displayName: 'Public Plugin',
      iconUrl: 'https://plugin.example.com/icon.svg',
      status: 'approved',
      developer: { name: 'Plugin Dev' },
      version: '1.2.3',
    },
  ]);
  assert.equal(res.body.nextPageToken, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.connectors[0], 'manifest'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.connectors[0], 'encodedSecretKey'), false);
  assert.deepEqual(queryCalls.filter((call) => call.method === 'eq'), [
    { method: 'eq', field: 'accountId', value: 'approved', negate: false },
    { method: 'eq', field: 'type', value: 'plugin', negate: false },
  ]);
});

test('Developer Console internal plugin catalog contract uses plugin cache and returns shared plus private plugins', async (t) => {
  const queryCalls = [];
  const cacheLookups = [];
  const batchGetCalls = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Cache: {
      async get(key) {
        cacheLookups.push(key);
        assert.deepEqual(key, {
          accountId: 'acc-2',
          id: 'internal-plugins',
        });
        return {
          internalConnectorIds: [
            { accountId: 'owner-1', id: 'shared-plugin' },
            { accountId: 'owner-1', id: 'shared-connector' },
          ],
        };
      },
    },
    Connector: {
      async batchGet(keys, options) {
        batchGetCalls.push({ keys, attributes: options.attributes });
        return [
          projectRecord({
            accountId: 'owner-1',
            id: 'shared-plugin',
            name: 'shared.plugin',
            type: 'plugin',
            displayName: 'Shared Plugin',
            iconUrl: 'https://plugin.example.com/shared.svg',
            status: 'private',
            developer: { name: 'Shared Dev' },
            version: '2.0.0',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          }, options.attributes),
          projectRecord({
            accountId: 'owner-1',
            id: 'shared-connector',
            name: 'shared.crm',
            type: 'connector',
            displayName: 'Shared CRM',
            status: 'private',
          }, options.attributes),
        ];
      },
      query(field) {
        assert.equal(field, 'accountId');
        return createQuery([
          {
            accountId: 'acc-2',
            id: 'private-plugin',
            name: 'private.plugin',
            type: 'plugin',
            displayName: 'Private Plugin',
            status: 'private',
            developer: { name: 'Private Dev' },
            version: '3.0.0',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          },
          {
            accountId: 'acc-2',
            id: 'approved-plugin',
            name: 'approved.plugin',
            type: 'plugin',
            displayName: 'Approved Plugin',
            status: 'approved',
          },
          {
            accountId: 'acc-2',
            id: 'private-connector',
            name: 'private.crm',
            type: 'connector',
            displayName: 'Private CRM',
            status: 'private',
          },
        ], queryCalls, field);
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getInternalConnectors(
    {
      query: {
        access: 'internal',
        type: 'plugin',
        accountId: 'acc-2',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(cacheLookups, [
    {
      accountId: 'acc-2',
      id: 'internal-plugins',
    },
  ]);
  assert.deepEqual(batchGetCalls[0].keys, [
    { accountId: 'owner-1', id: 'shared-plugin' },
    { accountId: 'owner-1', id: 'shared-connector' },
  ]);
  assert.deepEqual(res.body.sharedConnectors, [
    {
      accountId: 'owner-1',
      id: 'shared-plugin',
      name: 'shared.plugin',
      type: 'plugin',
      displayName: 'Shared Plugin',
      iconUrl: 'https://plugin.example.com/shared.svg',
      status: 'private',
      developer: { name: 'Shared Dev' },
      version: '2.0.0',
    },
  ]);
  assert.deepEqual(res.body.privateConnectors, [
    {
      accountId: 'acc-2',
      id: 'private-plugin',
      name: 'private.plugin',
      type: 'plugin',
      displayName: 'Private Plugin',
      status: 'private',
      developer: { name: 'Private Dev' },
      version: '3.0.0',
    },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.privateConnectors[0], 'manifest'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.sharedConnectors[0], 'encodedSecretKey'), false);
  assert.deepEqual(queryCalls.filter((call) => call.method === 'eq'), [
    { method: 'eq', field: 'accountId', value: 'acc-2', negate: false },
    { method: 'eq', field: 'status', value: 'approved', negate: true },
    { method: 'eq', field: 'type', value: 'plugin', negate: false },
  ]);
});

test('Developer Console public connector catalog pagination resumes from the approved partition without a user session', async (t) => {
  const queryCalls = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Connector: {
      query(field) {
        assert.equal(field, 'accountId');
        return createQuery([
          {
            id: 'public-connector-page-2',
            accountId: 'approved',
            name: 'public.crm.page2',
            type: 'connector',
            displayName: 'Public CRM Page 2',
            iconUrl: 'https://crm.example.com/icon.svg',
            status: 'approved',
            developer: { name: 'CRM Dev' },
            version: '4.0.0',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          },
        ], queryCalls, field);
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getApprovedConnectors(
    {
      query: {
        type: 'connector',
        pageToken: 'public-connector-page-2',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.connectors, [
    {
      id: 'public-connector-page-2',
      name: 'public.crm.page2',
      type: 'connector',
      displayName: 'Public CRM Page 2',
      iconUrl: 'https://crm.example.com/icon.svg',
      status: 'approved',
      developer: { name: 'CRM Dev' },
      version: '4.0.0',
    },
  ]);
  assert.deepEqual(queryCalls.filter((call) => call.method === 'startAt'), [
    {
      method: 'startAt',
      key: {
        id: 'public-connector-page-2',
        accountId: 'approved',
      },
    },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.connectors[0], 'manifest'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.connectors[0], 'encodedSecretKey'), false);
});

test('Developer Console public connector manifest contract exposes CRM manifest wrapper and proxy metadata', async (t) => {
  const crmManifest = {
    name: 'contract.crm',
    displayName: 'Contract CRM',
    serverUrl: 'https://crm-server.example.com',
    redirectUri: 'https://crm.example.com/oauth/callback',
    version: '5.0.0',
    environment: {
      type: 'fixed',
      url: 'https://tenant.example.com/app',
    },
    auth: {
      type: 'oauth',
      oauth: {
        clientId: 'client-id',
        redirectUri: 'https://crm.example.com/oauth/callback',
      },
    },
  };
  const connectorLookups = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Connector: {
      async get(key) {
        connectorLookups.push(key);
        assert.deepEqual(key, {
          id: 'contract-crm-public',
          accountId: 'approved',
        });
        return {
          id: 'contract-crm-public',
          name: 'contract.crm',
          type: 'connector',
          status: 'approved',
          manifest: { ...crmManifest },
          proxyId: 'approved-contract-crm-public',
          encodedSecretKey: 'secret-should-not-leak',
          developer: {
            name: 'CRM Dev',
            websiteUrl: 'https://crm.example.com',
          },
        };
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getManifest(
    {
      params: {
        id: 'contract-crm-public',
      },
      query: {
        type: 'connector',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(connectorLookups, [
    {
      id: 'contract-crm-public',
      accountId: 'approved',
    },
  ]);
  assert.equal(res.body.serverUrl, 'https://crm-server.example.com');
  assert.equal(res.body.redirectUri, 'https://crm.example.com/oauth/callback');
  assert.deepEqual(res.body.author, {
    name: 'CRM Dev',
    websiteUrl: 'https://crm.example.com',
  });
  assert.equal(res.body.version, '5.0.0');
  assert.deepEqual(res.body.platforms['contract.crm'], {
    ...crmManifest,
    proxyId: 'approved-contract-crm-public',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'encodedSecretKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'proxyId'), false);
});
test('Developer Console public connector catalog contract returns approved CRM connectors for client getPlatformList', async (t) => {
  const queryCalls = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Connector: {
      query(field) {
        assert.equal(field, 'accountId');
        return createQuery([
          {
            id: 'public-connector',
            accountId: 'approved',
            name: 'public.crm',
            type: 'connector',
            displayName: 'Public CRM',
            iconUrl: 'https://crm.example.com/icon.svg',
            status: 'approved',
            developer: { name: 'CRM Dev' },
            version: '1.2.3',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          },
          {
            id: 'public-plugin',
            accountId: 'approved',
            name: 'public.plugin',
            type: 'plugin',
            displayName: 'Public Plugin',
            status: 'approved',
          },
        ], queryCalls, field);
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getApprovedConnectors(
    {
      query: {
        type: 'connector',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.connectors, [
    {
      id: 'public-connector',
      name: 'public.crm',
      type: 'connector',
      displayName: 'Public CRM',
      iconUrl: 'https://crm.example.com/icon.svg',
      status: 'approved',
      developer: { name: 'CRM Dev' },
      version: '1.2.3',
    },
  ]);
  assert.equal(res.body.nextPageToken, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.connectors[0], 'manifest'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.connectors[0], 'encodedSecretKey'), false);
  assert.deepEqual(queryCalls.filter((call) => call.method === 'eq'), [
    { method: 'eq', field: 'accountId', value: 'approved', negate: false },
    { method: 'eq', field: 'type', value: 'connector', negate: false },
  ]);
});
test('Developer Console internal connector catalog contract uses connector cache and returns shared plus private CRM connectors', async (t) => {
  const queryCalls = [];
  const cacheLookups = [];
  const batchGetCalls = [];
  const connectorRouter = loadDeveloperConsoleConnectorRouter({
    Cache: {
      async get(key) {
        cacheLookups.push(key);
        assert.deepEqual(key, {
          accountId: 'acc-2',
          id: 'internal-connectors',
        });
        return {
          internalConnectorIds: [
            { accountId: 'owner-1', id: 'shared-connector' },
            { accountId: 'owner-1', id: 'shared-plugin' },
          ],
        };
      },
    },
    Connector: {
      async batchGet(keys, options) {
        batchGetCalls.push({ keys, attributes: options.attributes });
        return [
          projectRecord({
            accountId: 'owner-1',
            id: 'shared-connector',
            name: 'shared.crm',
            type: 'connector',
            displayName: 'Shared CRM',
            iconUrl: 'https://crm.example.com/shared.svg',
            status: 'private',
            developer: { name: 'Shared CRM Dev' },
            version: '2.0.0',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          }, options.attributes),
          projectRecord({
            accountId: 'owner-1',
            id: 'shared-plugin',
            name: 'shared.plugin',
            type: 'plugin',
            displayName: 'Shared Plugin',
            status: 'private',
          }, options.attributes),
        ];
      },
      query(field) {
        assert.equal(field, 'accountId');
        return createQuery([
          {
            accountId: 'acc-2',
            id: 'private-connector',
            name: 'private.crm',
            type: 'connector',
            displayName: 'Private CRM',
            status: 'private',
            developer: { name: 'Private CRM Dev' },
            version: '3.0.0',
            manifest: { shouldNotLeak: true },
            encodedSecretKey: 'secret',
          },
          {
            accountId: 'acc-2',
            id: 'approved-connector',
            name: 'approved.crm',
            type: 'connector',
            displayName: 'Approved CRM',
            status: 'approved',
          },
          {
            accountId: 'acc-2',
            id: 'private-plugin',
            name: 'private.plugin',
            type: 'plugin',
            displayName: 'Private Plugin',
            status: 'private',
          },
        ], queryCalls, field);
      },
    },
  }, t);
  const res = createResponse();

  await connectorRouter.getInternalConnectors(
    {
      query: {
        access: 'internal',
        type: 'connector',
        accountId: 'acc-2',
      },
    },
    res,
    (error) => {
      throw error;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(cacheLookups, [
    {
      accountId: 'acc-2',
      id: 'internal-connectors',
    },
  ]);
  assert.deepEqual(batchGetCalls[0].keys, [
    { accountId: 'owner-1', id: 'shared-connector' },
    { accountId: 'owner-1', id: 'shared-plugin' },
  ]);
  assert.deepEqual(res.body.sharedConnectors, [
    {
      accountId: 'owner-1',
      id: 'shared-connector',
      name: 'shared.crm',
      type: 'connector',
      displayName: 'Shared CRM',
      iconUrl: 'https://crm.example.com/shared.svg',
      status: 'private',
      developer: { name: 'Shared CRM Dev' },
      version: '2.0.0',
    },
  ]);
  assert.deepEqual(res.body.privateConnectors, [
    {
      accountId: 'acc-2',
      id: 'private-connector',
      name: 'private.crm',
      type: 'connector',
      displayName: 'Private CRM',
      status: 'private',
      developer: { name: 'Private CRM Dev' },
      version: '3.0.0',
    },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.privateConnectors[0], 'manifest'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body.sharedConnectors[0], 'encodedSecretKey'), false);
  assert.deepEqual(queryCalls.filter((call) => call.method === 'eq'), [
    { method: 'eq', field: 'accountId', value: 'acc-2', negate: false },
    { method: 'eq', field: 'status', value: 'approved', negate: true },
    { method: 'eq', field: 'type', value: 'connector', negate: false },
  ]);
});