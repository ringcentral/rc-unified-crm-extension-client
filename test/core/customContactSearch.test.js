const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

async function loadCustomContactSearch({ axiosGet, notifications = [] } = {}) {
  return loadBundledModule('src/core/customContactSearch.js', {
    stubs: {
      axios: {
        async get(url, options) {
          return axiosGet(url, options);
        },
      },
      '../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
      },
    },
  });
}

test('custom contact search builds a reusable search page with the selected adapter button and form state', async () => {
  const customContactSearch = await loadCustomContactSearch({
    axiosGet() {
      throw new Error('building the local search page should not call the server');
    },
  });

  const page = customContactSearch.getCustomContactSearch({
    contactSearchAdapterButton: 'contactSearchAdapterButtonMessageLog',
    contactPhoneNumber: '+15550100',
    appointment: true,
    formData: {
      appointmentCreateDraft: {
        emailMandatoryInAttendee: false,
      },
      existingField: 'kept',
    },
  });

  assert.equal(page.id, 'searchContact');
  assert.equal(page.type, 'page');
  assert.deepEqual(Object.keys(page.schema.properties), [
    'contactNameToSearch',
    'contactSearchAdapterButtonMessageLog',
  ]);
  assert.deepEqual(page.uiSchema['ui:order'], [
    'contactNameToSearch',
    'contactSearchAdapterButtonMessageLog',
  ]);
  assert.deepEqual(page.formData, {
    contactPhoneNumber: '+15550100',
    appointment: true,
    appointmentCreateDraft: {
      emailMandatoryInAttendee: false,
    },
    existingField: 'kept',
  });
});

test('custom contact search data queries the CRM adapter and returns a list page for call and message logs', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const axiosGets = [];
  const notifications = [];

  const customContactSearch = await loadCustomContactSearch({
    notifications,
    async axiosGet(url, options) {
      axiosGets.push({ url, options });
      return {
        data: {
          contact: [
            {
              id: 'lead-1',
              name: 'Ada Lovelace',
              type: 'Lead',
            },
            {
              id: 'contact-2',
              name: 'Grace Hopper',
              type: 'Contact',
            },
          ],
        },
      };
    },
  });

  const page = await customContactSearch.getCustomContactSearchData({
    serverUrl: 'https://server.example.com',
    platform: {
      name: 'acme',
    },
    contactSearch: 'Ada',
    pageId: 'contactSearchResultCallLog',
    contactPhoneNumber: '+15550100',
    formData: {
      sourcePage: 'callLog',
    },
  });

  assert.deepEqual(axiosGets, [
    {
      url: 'https://server.example.com/custom/contact/search',
      options: {
        params: {
          jwtToken: 'crm-jwt',
          name: 'Ada',
        },
      },
    },
  ]);
  assert.deepEqual(notifications, []);
  assert.deepEqual(page.schema.properties.contactList, {
    type: 'string',
    title: 'Contacts',
    oneOf: [
      {
        const: 'lead-1',
        title: 'Ada Lovelace',
        description: 'Lead - lead-1',
      },
      {
        const: 'contact-2',
        title: 'Grace Hopper',
        description: 'Contact - contact-2',
      },
    ],
  });
  assert.deepEqual(page.uiSchema.contactList, {
    'ui:field': 'list',
  });
  assert.deepEqual(page.formData, {
    search: 'Ada',
    contactPhoneNumber: '+15550100',
    contactInfo: [
      {
        id: 'lead-1',
        name: 'Ada Lovelace',
        type: 'Lead',
      },
      {
        id: 'contact-2',
        name: 'Grace Hopper',
        type: 'Contact',
      },
    ],
    sourcePage: 'callLog',
  });
});

test('custom contact search data disables appointment attendees without email when email is mandatory', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const customContactSearch = await loadCustomContactSearch({
    async axiosGet() {
      return {
        data: {
          contact: [
            {
              id: 100,
              name: 'Ada Lovelace',
              type: 'Lead',
              email: 'ada@example.com',
            },
            {
              id: 200,
              name: 'No Email Contact',
              type: 'Contact',
              email: '   ',
            },
          ],
        },
      };
    },
  });

  const page = await customContactSearch.getCustomContactSearchData({
    serverUrl: 'https://server.example.com',
    contactSearch: 'Ada',
    pageId: 'appointmentContactSearch',
    contactPhoneNumber: '+15550100',
    appointment: true,
    formData: {
      appointmentCreateDraft: {
        emailMandatoryInAttendee: true,
      },
    },
  });

  assert.equal(page.schema.properties.appointmentContactEmailWarning.description,
    'Email is required for appointment attendees. Contacts without an email address are disabled.');
  assert.deepEqual(page.schema.properties.contactList, {
    type: 'array',
    title: 'Contacts',
    items: {
      type: 'string',
      enum: ['100', '200'],
      enumNames: ['Ada Lovelace', 'No Email Contact'],
      enumDisabled: ['200'],
    },
    uniqueItems: true,
    minItems: 1,
  });
  assert.deepEqual(page.uiSchema.submitButtonOptions, {
    submitText: 'Add',
  });
  assert.deepEqual(page.uiSchema.contactList, {
    'ui:widget': 'checkboxes',
    'ui:enumDisabled': ['200'],
    'ui:options': {
      enumDisabled: ['200'],
    },
  });
});

test('custom contact search data shows the server return message when no contacts match', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const notifications = [];
  const customContactSearch = await loadCustomContactSearch({
    notifications,
    async axiosGet() {
      return {
        data: {
          contact: [],
          returnMessage: {
            messageType: 'warning',
            message: 'No contacts found',
            ttl: 3000,
          },
        },
      };
    },
  });

  const page = await customContactSearch.getCustomContactSearchData({
    serverUrl: 'https://server.example.com',
    contactSearch: 'Missing',
    pageId: 'contactSearchResultCallLog',
    contactPhoneNumber: '+15550100',
  });

  assert.equal(page, undefined);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'No contacts found',
      ttl: 3000,
    },
  ]);
});
