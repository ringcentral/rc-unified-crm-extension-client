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

test('user mapping page search re-renders the mapping list with search and filter', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];

  const userMappingPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/userMappingPage.js',
    {
      stubs: {
        '../../../../../components/admin/userMappingPage/userMappingPage': {
          getUserMappingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'userMappingPage',
              searchWord: args.searchWord,
              filter: args.filter,
            };
          },
        },
      },
    }
  );

  const allUserMapping = [
    {
      crmUserId: 'crm-user-1',
      crmUserName: 'Ada Lovelace',
    },
  ];

  await userMappingPage.onEvent({
    data: {
      body: {
        formData: {
          allUserMapping,
          userSearch: {
            search: 'Ada',
            filter: 'mapped',
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {
      displayName: 'Acme CRM',
    },
  });

  assert.deepEqual(renderCalls, [
    {
      userMapping: allUserMapping,
      platformDisplayName: 'Acme CRM',
      searchWord: 'Ada',
      filter: 'mapped',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'userMappingPage',
          searchWord: 'Ada',
          filter: 'mapped',
        },
      },
      targetOrigin: undefined,
    },
  ]);
});

test('edit user mapping page input change re-renders with the selected RingCentral extension', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];

  const editUserMappingPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/editUserMappingPage.js',
    {
      stubs: {
        '../../../../../components/admin/userMappingPage/editUserMappingPage': {
          renderEditUserMappingPage(args) {
            renderCalls.push(args);
            return {
              id: 'editUserMappingPage',
              selectedRcExtensionId: args.selectedRcExtensionId,
            };
          },
        },
      },
    }
  );

  const userMapping = {
    crmUserId: 'crm-user-1',
    crmUserName: 'Ada Lovelace',
  };
  const rcExtensions = [
    {
      id: 'rc-ext-1',
      name: 'Ada',
    },
  ];

  await editUserMappingPage.onEvent({
    data: {
      body: {
        formData: {
          searchWord: 'Ada',
          userMapping,
          rcExtensions,
          rcExtensionList: 'rc-ext-1',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {
      displayName: 'Acme CRM',
    },
  });

  assert.deepEqual(renderCalls, [
    {
      userMapping,
      platformDisplayName: 'Acme CRM',
      rcExtensions,
      selectedRcExtensionId: 'rc-ext-1',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'editUserMappingPage',
          selectedRcExtensionId: 'rc-ext-1',
        },
      },
      targetOrigin: undefined,
    },
  ]);
});
