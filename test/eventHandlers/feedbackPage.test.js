const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(openedWindows, widgetMessages) {
  global.window = {
    open(url, target) {
      openedWindows.push({ url, target });
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

test('feedback page submit opens a populated external feedback form and returns to the widget', async () => {
  const storage = createChromeStorage({
    rcUserInfo: {
      rcUserName: 'Ada Lovelace',
      rcUserEmail: 'ada@example.com',
    },
  });
  global.chrome = storage.chrome;

  const openedWindows = [];
  const widgetMessages = [];
  installWindowAndAdapter(openedWindows, widgetMessages);

  const feedbackPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/navigation/feedbackPage.js'
  );

  await feedbackPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            issueType: 'Bug report',
            notes: 'Need help & logs',
          },
        },
      },
    },
    manifest: {
      version: '1.7.35',
      platforms: {
        acme: {
          displayName: 'Acme CRM',
          page: {
            feedback: {
              url: 'https://feedback.example.com/form?type={issueType}&notes={notes}&crm={crmName}&name={userName}&email={userEmail}&version={version}',
            },
          },
        },
      },
    },
    platformName: 'acme',
  });

  assert.deepEqual(openedWindows, [
    {
      url: 'https://feedback.example.com/form?type=Bug%20report&notes=Need%20help%20%26%20logs&crm=Acme CRM&name=Ada Lovelace&email=ada@example.com&version=1.7.35',
      target: '_blank',
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
