const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

test('/settings saves flattened widget settings and responds to the widget', async () => {
  const refreshCalls = [];
  const notifications = [];
  const responses = [];

  const settingsHandler = await loadBundledModule('src/eventHandlers/rc-post-message-request/settings.js', {
    stubs: {
      '../../core/user': {
        async refreshUserSettings(args) {
          refreshCalls.push(args);
          return {
            autoLogCall: { value: true },
            showChatTab: { value: false },
            notificationLevel: { value: 'Important' },
          };
        },
      },
      '../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
      '../../service/embeddableServices': {},
      '../../components/appointmentsPage/appointmentsPage': {
        getAppointmentsPageRender() {
          throw new Error('Appointments page should not be re-registered when appointment support is disabled');
        },
      },
    },
  });

  await settingsHandler.onEvent({
    data: {
      requestId: 'req-settings',
      body: {
        setting: {
          id: 'autoLogCall',
          value: true,
        },
        settings: [
          {
            id: 'logging',
            items: [
              {
                id: 'autoLogCall',
                value: true,
              },
              {
                id: 'tabs',
                items: [
                  {
                    id: 'showChatTab',
                    value: false,
                  },
                ],
              },
            ],
          },
          {
            id: 'notificationLevel',
            value: 'Important',
          },
        ],
      },
    },
    manifest: {
      platforms: {
        acme: {
          page: {},
        },
      },
    },
    platformName: 'acme',
  });

  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        autoLogCall: { value: true },
        showChatTab: { value: false },
        notificationLevel: { value: 'Important' },
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Settings saved.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-settings',
      payload: {
        data: 'ok',
      },
    },
  ]);
});
