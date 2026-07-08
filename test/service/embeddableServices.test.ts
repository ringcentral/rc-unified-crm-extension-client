import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

function setting(value = false, overrides = {}) {
  return {
    value,
    readOnly: false,
    readOnlyReason: '',
    warning: '',
    ...overrides,
  };
}

function userCoreProxy() {
  const fns = new Map();
  return new Proxy({}, {
    get(_target, prop) {
      if (!fns.has(prop)) {
        const fn = vi.fn((userSettings, id, defaultValue) => {
          switch (prop) {
            case 'getPhoneNumberDisplayFormatTypeSetting':
              return setting('custom', { readOnly: true, readOnlyReason: 'Managed by admin' });
            case 'getPhoneNumberDisplayFormatTemplateSetting':
              return setting('(###) ###-####');
            case 'getAutoLogSMSSetting':
              return setting(true, { readOnlyReason: 'Managed SMS' });
            case 'getNotificationLevelSetting':
              return setting(['success', 'warning']);
            case 'getQuickAccessButtonSizeSetting':
              return setting('small');
            case 'getIncomingCallPop':
            case 'getOutgoingCallPop':
            case 'getCallPopMultiMatchBehavior':
              return setting('promptToSelect');
            case 'getC2DMatcherTypeSetting':
              return setting('regExp');
            case 'getClickToDialEmbedMode':
            case 'getQuickAccessButtonEmbedMode':
              return setting('whitelist');
            case 'getClickToDialUrls':
            case 'getQuickAccessButtonUrls':
              return setting(['https://crm.example']);
            case 'getNewContactTypeSetting':
              return setting('Lead');
            case 'getDeveloperModeSetting':
              return setting(true);
            case 'getCustomSetting':
              return setting(defaultValue ?? 'custom-value', {
                options: [{ id: 'dynamic', name: 'Dynamic' }],
              });
            default:
              return setting(userSettings?.[prop]?.value ?? false);
          }
        });
        fns.set(prop, fn);
      }
      return fns.get(prop);
    },
  });
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    author: { name: 'RingCentral' },
    platforms: {
      googleSheets: {
        name: 'googleSheets',
        displayName: 'Google Sheets',
        logoUrl: 'https://logo.example/google-sheets.png',
        useLicense: true,
        hideEditLogButton: true,
        trackSmsTypingDuration: true,
        enableExtensionNumberLoggingSetting: true,
        contactTypes: [{ value: 'Lead', display: 'Lead' }],
        page: {
          appointment: {
            supported: true,
            title: 'CRM Appointments',
          },
        },
        settings: [
          {
            id: 'visibleOptions',
            type: 'section',
            name: 'Visible Options',
            group: 'general',
            items: [
              {
                id: 'customText',
                type: 'inputField',
                name: 'Custom Text',
                defaultValue: 'default text',
              },
              {
                id: 'customBoolean',
                type: 'boolean',
                name: 'Custom Boolean',
                defaultValue: true,
              },
              {
                id: 'customWarning',
                type: 'warning',
                name: 'Heads up',
                value: 'Check configuration',
              },
              {
                id: 'customOption',
                type: 'option',
                name: 'Custom Option',
                dynamicOptions: true,
                multiple: true,
                checkbox: true,
                required: true,
              },
              {
                id: 'customButton',
                type: 'button',
                name: 'Custom Button',
                buttonLabel: 'Launch',
              },
              {
                id: 'deniedByPermission',
                type: 'boolean',
                name: 'Denied',
                requiredPermission: 'missingPermission',
              },
            ],
          },
          {
            id: 'hiddenOptions',
            type: 'section',
            name: 'Hidden Options',
            visibleToUsers: false,
            items: [{ id: 'hidden', type: 'boolean', name: 'Hidden' }],
          },
          {
            id: 'callLogDetailsDuplicate',
            type: 'section',
            name: 'Duplicate',
            items: [{ id: 'addCallLogNote', type: 'boolean', name: 'Skip me' }],
          },
        ],
      },
    },
  };
}

async function loadEmbeddableServices() {
  vi.resetModules();
  const userCore = userCoreProxy();
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));
  const authCore = {
    getLicenseStatus: vi.fn(async () => ({
      licenseStatus: 'Active',
      licenseStatusColor: 'inherit',
      licenseStatusDescription: 'Ready',
    })),
  };
  vi.doMock('../../src/core/auth.ts', () => ({ default: authCore }));
  vi.doMock('../../src/service/platformService.ts', () => ({
    getPlatformInfo: vi.fn(async () => ({
      platformName: 'googleSheets',
      hostname: 'sheets.example',
    })),
  }));
  vi.doMock('../../src/service/manifestService.ts', () => ({
    getManifest: vi.fn(async () => manifest()),
  }));
  vi.doMock('../../src/i18n/index.ts', () => ({
    t: vi.fn((key, values) => (values?.author ? `${key}:${values.author}` : key)),
  }));
  const embeddableServices = await loadModule('../../src/service/embeddableServices.ts');
  return {
    embeddableServices,
    userCore,
    authCore,
  };
}

async function loadAuthedAdminServiceManifest() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T08:00:00Z'));
  seedStorage({
    isAdmin: true,
    crmAuthed: true,
    developerMode: true,
    crmUserInfo: { name: 'CRM User' },
    userPermissions: {},
    userSettings: {
      allowExtensionNumberLogging: { value: true, customizable: false },
    },
  });
  const loaded = await loadEmbeddableServices();
  const service = await loaded.embeddableServices.getServiceManifest();
  return {
    ...loaded,
    service,
  };
}

describe('embeddableServices', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers a placeholder service before CRM selection', async () => {
    const { embeddableServices } = await loadEmbeddableServices();

    await embeddableServices.preconfigureServiceManifest();

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: expect.objectContaining({
          name: 'placeholder',
          authorizationPath: '/platform-selection',
          authorized: false,
        }),
      },
      targetOrigin: '*',
    });
  });

  it('builds authorized service identity and license metadata', async () => {
    const { service, authCore } = await loadAuthedAdminServiceManifest();

    expect(service).toMatchObject({
      name: 'googleSheets',
      displayName: 'Google Sheets',
      authorized: true,
      authorizedAccount: 'CRM User common.labels.admin',
      authorizationLogo: 'https://logo.example/google-sheets.png',
      callLoggerHideEditLogButton: true,
      messageLoggerAutoSettingReadOnlyValue: true,
      licenseStatus: 'License: Active',
      licenseStatusColor: 'inherit',
      licenseDescription: 'Ready',
      banner: expect.objectContaining({
        id: 'temp-webinar-banner',
      }),
    });
    expect(authCore.getLicenseStatus).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });
  });

  it('posts phone-number format and SMS typing side effects to the widget', async () => {
    await loadAuthedAdminServiceManifest();

    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-set-phone-number-format',
          formatType: 'custom',
          template: '(###) ###-####',
          readOnly: true,
          readOnlyReason: 'Managed by admin',
        },
        targetOrigin: '*',
      },
      {
        message: {
          type: 'rc-adapter-update-sms-typing-time-tracking',
          enabled: true,
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('builds visible custom connector settings and filters hidden or unauthorized entries', async () => {
    const { service } = await loadAuthedAdminServiceManifest();

    const settingIds = service.settings.map((item) => item.id);
    expect(settingIds).toEqual(expect.arrayContaining([
      'googleSheetsConfig',
      'visibleOptions',
      'clickToDialMatcher',
      'clickToDialEmbed',
      'callLogDetails',
      'autoLogPreferences',
      'openDeveloperSettingsPage',
    ]));
    expect(settingIds).not.toContain('hiddenOptions');
    expect(settingIds).not.toContain('callLogDetailsDuplicate');

    const visibleOptions = service.settings.find((item) => item.id === 'visibleOptions');
    expect(visibleOptions).toMatchObject({
      groupId: 'general',
      items: [
        expect.objectContaining({ id: 'customText', value: 'default text' }),
        expect.objectContaining({ id: 'customBoolean', value: true }),
        expect.objectContaining({ id: 'customWarning', type: 'admonition' }),
        expect.objectContaining({
          id: 'customOption',
          options: [{ id: 'dynamic', name: 'Dynamic' }],
          multiple: true,
          checkbox: true,
          required: true,
        }),
        expect.objectContaining({ id: 'customButton', buttonLabel: 'Launch' }),
      ],
    });
    expect(visibleOptions.items.map((item) => item.id)).not.toContain('deniedByPermission');
  });

  it('adds built-in appointment and extension-number settings for supported platforms', async () => {
    const { service } = await loadAuthedAdminServiceManifest();

    const appearanceGroup = service.settings.find((item) => item.id === 'appearance');
    const tabsSection = appearanceGroup.items.find((item) => item.id === 'tabs');
    expect(tabsSection.items.map((item) => item.id)).toContain('showAppointmentsTab');

    const contactsSection = service.settings.find((item) => item.id === 'contacts');
    expect(contactsSection.items.map((item) => item.id)).toContain('allowExtensionNumberLogging');
  });
});
