const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installAdapter(widgetMessages) {
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

test('dialer ready replays cached click-to-dial request to the widget', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const runtimeMessages = [];
  global.chrome = {
    runtime: {
      async sendMessage(message) {
        runtimeMessages.push(message);
        return {
          type: 'c2d',
          phoneNumber: '+15550100',
        };
      },
    },
  };

  const dialerStatus = await loadBundledModule('src/eventHandlers/rc-dialer-status-notify.js', {
    stubs: {
      '../core/contact': {},
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
            platforms: {
              acme: {},
            },
          };
        },
      },
      '../components/schedulePage': {},
    },
  });

  await dialerStatus.onEvent({
    data: {
      ready: true,
    },
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'checkForClickToXCache',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-new-call',
        phoneNumber: '+15550100',
        toCall: true,
      },
      targetOrigin: '*',
    },
  ]);
});

test('dialer ready replays cached click-to-SMS request with cached recipient name', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  global.chrome = {
    runtime: {
      async sendMessage() {
        return {
          type: 'c2sms',
          phoneNumber: '+15550101',
        };
      },
    },
  };

  const localContactCalls = [];

  const dialerStatus = await loadBundledModule('src/eventHandlers/rc-dialer-status-notify.js', {
    stubs: {
      '../core/contact': {
        getLocalCachedContact(args) {
          localContactCalls.push(args);
          return [
            {
              name: 'Ada Lovelace',
            },
          ];
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return {
            platforms: {
              acme: {},
            },
          };
        },
      },
      '../components/schedulePage': {},
    },
  });

  await dialerStatus.onEvent({
    data: {
      ready: true,
    },
  });

  assert.deepEqual(localContactCalls, [
    {
      phoneNumber: '+15550101',
      platformName: 'acme',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+15550101',
        conversation: true,
        recipient: {
          name: 'Ada Lovelace',
        },
      },
      targetOrigin: '*',
    },
  ]);
});

test('dialer ready replays cached click-to-schedule request by registering a schedule page', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  global.chrome = {
    runtime: {
      async sendMessage() {
        return {
          type: 'c2schedule',
          phoneNumber: '+15550102',
        };
      },
    },
  };

  const getContactCalls = [];
  const schedulePageCalls = [];

  const dialerStatus = await loadBundledModule('src/eventHandlers/rc-dialer-status-notify.js', {
    stubs: {
      '../core/contact': {
        async getContact(args) {
          getContactCalls.push(args);
          return {
            contactInfo: [
              {
                id: 'crm-contact-1',
                name: 'Ada Lovelace',
              },
              {
                id: 'new-placeholder',
                isNewContact: true,
              },
            ],
          };
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
            platforms: {
              acme: {
                contactTypes: [
                  {
                    value: 'Lead',
                  },
                ],
              },
            },
          };
        },
      },
      '../components/schedulePage': {
        getSchedulePageRender(args) {
          schedulePageCalls.push(args);
          return {
            id: 'schedulePage',
            preselect: args.preselect,
          };
        },
      },
    },
  });

  await dialerStatus.onEvent({
    data: {
      ready: true,
    },
  });

  assert.deepEqual(getContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550102',
      platformName: 'acme',
      isForceRefresh: true,
      isToTriggerContactMatch: true,
    },
  ]);
  assert.deepEqual(schedulePageCalls, [
    {
      phoneNumber: '+15550102',
      listOneOf: [
        {
          const: 'crm-contact-1',
          title: 'Ada Lovelace',
        },
        {
          const: 'newContact',
          title: 'Create new contact',
        },
      ],
      isDefaultNew: false,
      preselect: 'crm-contact-1',
      contactTypes: [
        {
          value: 'Lead',
        },
      ],
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'schedulePage',
          preselect: 'crm-contact-1',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/schedulePage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('side drawer open notify forwards drawer state to the service worker', async () => {
  const runtimeMessages = [];
  global.chrome = {
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const sideDrawer = await loadBundledModule('src/eventHandlers/rc-adapter-side-drawer-open-notify.js');

  await sideDrawer.onEvent({
    data: {
      open: true,
    },
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'sideWidgetOpen',
      opened: true,
    },
  ]);
});

test('AI assistant settings notify persists widget settings without forcing managed overrides', async () => {
  const refreshCalls = [];

  const aiSettings = await loadBundledModule('src/eventHandlers/rc-adapter-ai-assistant-settings-notify.js', {
    stubs: {
      '../core/user': {
        async refreshUserSettings(args) {
          refreshCalls.push(args);
        },
      },
    },
  });

  await aiSettings.onEvent({
    data: {
      showAiAssistantWidget: true,
      autoStartAiAssistant: false,
    },
  });

  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        showAiAssistantWidget: {
          value: true,
        },
        autoStartAiAssistant: {
          value: false,
        },
      },
      isAvoidForceChange: true,
    },
  ]);
});

test('phone number format notify persists format settings and read-only customization state', async () => {
  const refreshCalls = [];

  const phoneFormat = await loadBundledModule('src/eventHandlers/rc-adapter-phone-number-format-settings-notify.js', {
    stubs: {
      '../core/user': {
        async refreshUserSettings(args) {
          refreshCalls.push(args);
        },
      },
    },
  });

  await phoneFormat.onEvent({
    data: {
      formatType: 'national',
      template: '(###) ###-####',
      readOnly: true,
    },
  });

  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        phoneNumberDisplayFormatType: {
          value: 'national',
          customizable: false,
        },
        phoneNumberDisplayFormatTemplate: {
          value: '(###) ###-####',
          customizable: false,
        },
      },
    },
  ]);
});

test('analytics notify tracks WebRTC call end with cached call context and clears ongoing call state', async () => {
  const storage = createChromeStorage({
    callWith: 'RingCentral app',
    callingMode: 'webphone',
    hasOngoingCall: true,
  });
  global.chrome = storage.chrome;

  const analyticsCalls = [];

  const analyticsTrack = await loadBundledModule('src/eventHandlers/rc-analytics-track.js', {
    stubs: {
      '../lib/analytics': {
        trackSentSMS() {
          analyticsCalls.push({
            type: 'sms',
          });
        },
        trackCreateMeeting() {
          analyticsCalls.push({
            type: 'meeting',
          });
        },
        trackCallEnd(payload) {
          analyticsCalls.push({
            type: 'callEnd',
            payload,
          });
        },
      },
    },
  });

  await analyticsTrack.onEvent({
    data: {
      event: 'WebRTC Call Ended',
      properties: {
        direction: 'Outbound',
        duration: 42,
        result: 'Disconnected',
      },
    },
  });

  assert.equal(storage.store.hasOngoingCall, false);
  assert.deepEqual(analyticsCalls, [
    {
      type: 'callEnd',
      payload: {
        direction: 'Outbound',
        durationInSeconds: 42,
        result: 'Disconnected',
        callWith: 'RingCentral app',
        callingMode: 'webphone',
      },
    },
  ]);
});

test('call lifecycle analytics notify handlers track placed, answered inbound, and connected calls', async () => {
  const analyticsCalls = [];
  const analyticsStub = {
    trackPlacedCall() {
      analyticsCalls.push('placed');
    },
    trackAnsweredCall() {
      analyticsCalls.push('answered');
    },
    trackConnectedCall() {
      analyticsCalls.push('connected');
    },
  };

  const callInit = await loadBundledModule('src/eventHandlers/rc-call-init-notify.js', {
    stubs: {
      '../lib/analytics': analyticsStub,
    },
  });
  const callStart = await loadBundledModule('src/eventHandlers/rc-call-start-notify.js', {
    stubs: {
      '../lib/analytics': analyticsStub,
    },
  });
  const ringout = await loadBundledModule('src/eventHandlers/rc-ringout-call-notify.js', {
    stubs: {
      '../lib/analytics': analyticsStub,
    },
  });

  await callInit.onEvent({
    data: {},
  });
  await callStart.onEvent({
    data: {
      call: {
        direction: 'Inbound',
      },
    },
  });
  await callStart.onEvent({
    data: {
      call: {
        direction: 'Outbound',
      },
    },
  });
  await ringout.onEvent({
    data: {
      call: {
        telephonyStatus: 'CallConnected',
      },
    },
  });
  await ringout.onEvent({
    data: {
      call: {
        telephonyStatus: 'Ringing',
      },
    },
  });

  assert.deepEqual(analyticsCalls, ['placed', 'answered', 'connected']);
});
