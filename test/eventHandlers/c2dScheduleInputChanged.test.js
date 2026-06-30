const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

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

function createSchedulePage() {
  return {
    id: 'c2dSchedulePage',
    title: 'Schedule callback',
    type: 'page',
    schema: {
      type: 'object',
      properties: {
        callbackDateTime: {
          type: 'string',
          format: 'date-time',
        },
        newContactName: {
          type: 'string',
        },
        newContactType: {
          type: 'string',
        },
        scheduleSubmit: {
          type: 'string',
        },
      },
    },
    uiSchema: {
      scheduleSubmit: {
        submitText: 'Schedule',
      },
    },
  };
}

test('c2d schedule page clears past callback time and disables submit for incomplete new contact', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const c2dSchedulePage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/c2dSchedulePage.js'
  );

  await c2dSchedulePage.onEvent({
    data: {
      body: {
        keys: ['callbackDateTime'],
        page: createSchedulePage(),
        formData: {
          contact: 'newContact',
          callbackDateTime: '2000-01-01T10:00:00.000Z',
          newContactName: '',
        },
      },
    },
    manifest: {
      platforms: {
        acme: {
          contactTypes: [
            {
              value: 'Lead',
            },
            {
              value: 'Contact',
            },
          ],
        },
      },
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  const page = widgetMessages[0].message.page;
  assert.equal(page.formData.callbackDateTime, '');
  assert.equal(page.formData.newContactType, 'Lead');
  assert.deepEqual(page.uiSchema.newContactName, {
    'ui:widget': 'text',
    'ui:placeholder': 'Enter name...',
  });
  assert.deepEqual(page.uiSchema.newContactType, {});
  assert.equal(page.uiSchema.scheduleSubmit['ui:disabled'], true);
  assert.match(page.schema.properties.callbackDateTime.minimum, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(widgetMessages[0].targetOrigin, '*');
});

test('c2d schedule page hides new-contact fields and enables submit for an existing contact with future callback time', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const c2dSchedulePage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/c2dSchedulePage.js'
  );

  await c2dSchedulePage.onEvent({
    data: {
      body: {
        keys: ['contact'],
        page: createSchedulePage(),
        formData: {
          contact: 'crm-contact-1',
          callbackDateTime: '2999-01-01T10:00:00.000Z',
          newContactName: 'Should be cleared',
          newContactType: 'Lead',
        },
      },
    },
    manifest: {
      platforms: {
        acme: {
          contactTypes: [
            {
              value: 'Lead',
            },
          ],
        },
      },
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  const page = widgetMessages[0].message.page;
  assert.equal(page.formData.callbackDateTime, '2999-01-01T10:00:00.000Z');
  assert.equal(page.formData.newContactName, '');
  assert.equal(page.formData.newContactType, '');
  assert.deepEqual(page.uiSchema.newContactName, {
    'ui:widget': 'hidden',
  });
  assert.deepEqual(page.uiSchema.newContactType, {
    'ui:widget': 'hidden',
  });
  assert.equal(page.uiSchema.scheduleSubmit['ui:disabled'], false);
});
