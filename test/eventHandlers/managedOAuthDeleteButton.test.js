const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

function installWindowAndAdapter(windowMessages = [], widgetMessages = []) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            widgetMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };
}

test('delete managed OAuth account deletes the server account, notifies success, and navigates back', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const deleteCalls = [];
  const notifications = [];

  const deleteManagedOAuthAccount = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/deleteManagedOAuthAccount.js',
    {
      stubs: {
        '../../../../core/admin': {
          async deleteManagedOAuthAccount(args) {
            deleteCalls.push(args);
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
      },
    }
  );

  await deleteManagedOAuthAccount.onEvent({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(deleteCalls, [
    {
      serverUrl: 'https://server.example.com',
      platformName: 'acme',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Managed OAuth account deleted.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      },
      targetOrigin: '*',
    },
  ]);
});

test('delete managed OAuth account reports failure and does not navigate when server delete fails', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const notifications = [];
  const deleteManagedOAuthAccount = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/deleteManagedOAuthAccount.js',
    {
      stubs: {
        '../../../../core/admin': {
          async deleteManagedOAuthAccount() {
            throw new Error('delete failed');
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
      },
    }
  );

  await deleteManagedOAuthAccount.onEvent({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'error',
      message: 'Failed to delete managed OAuth account. Please try again.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(widgetMessages, []);
});
