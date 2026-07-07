import axios from 'axios';
import { openDB } from 'idb';
import { getRcAccessToken, getRcInfo, setRcAdditionalSubmission, showNotification } from '../../src/lib/util.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { trackCrmLogin, trackCrmLogout } from '../../src/lib/analytics.ts';
import platformSelectionPage from '../../src/components/platformSelectionPage.ts';
import authPage from '../../src/components/authPage.ts';
import managedOAuthSetupPage from '../../src/components/managedOAuthSetupPage.ts';
import managedOAuthMissingPage from '../../src/components/managedOAuthMissingPage.ts';
import { tryConnectToBullhorn } from '../../src/misc/bullhorn.ts';
import { getPluginConfigurePageRender } from '../../src/components/pluginConfigurePage.ts';
import pluginService from '../../src/service/pluginService.ts';
import embeddableServices from '../../src/service/embeddableServices.ts';
import adminCore from '../../src/core/admin.ts';
import userCore from '../../src/core/user.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
  getRcInfo: vi.fn(),
  showNotification: vi.fn(),
  setRcAdditionalSubmission: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/lib/analytics.ts', () => ({
  trackCrmLogin: vi.fn(),
  trackCrmLogout: vi.fn(),
}));

vi.mock('../../src/components/platformSelectionPage.ts', () => ({
  default: {
    getPlatformSelectionPageRender: vi.fn(() => ({ id: 'platformSelectionPage' })),
  },
}));

vi.mock('../../src/components/authPage.ts', () => ({
  default: {
    getAuthPageRender: vi.fn(() => ({ id: 'authPage' })),
  },
}));

vi.mock('../../src/components/managedOAuthSetupPage.ts', () => ({
  default: {
    getManagedOAuthSetupPageRender: vi.fn(() => ({ id: 'managedOAuthSetupPage' })),
  },
}));

vi.mock('../../src/components/managedOAuthMissingPage.ts', () => ({
  default: {
    getManagedOAuthMissingPageRender: vi.fn(() => ({ id: 'managedOAuthMissingPage' })),
  },
}));

vi.mock('../../src/components/pluginConfigurePage.ts', () => ({
  getMergedPluginConfigFromFormData: vi.fn(() => ({})),
  getPluginConfigurePageRender: vi.fn(() => ({ id: 'pluginConfigurePage' })),
}));

vi.mock('../../src/misc/bullhorn.ts', () => ({
  tryConnectToBullhorn: vi.fn(),
}));

vi.mock('../../src/i18n/index.ts', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../../src/service/embeddableServices.ts', () => ({
  default: {
    preconfigureServiceManifest: vi.fn(),
  },
}));

vi.mock('../../src/service/pluginService.ts', () => ({
  default: {
    getPluginLicenseStatus: vi.fn(),
  },
}));

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    refreshAdminSettings: vi.fn(async () => ({})),
    authAppConnectServer: vi.fn(),
  },
}));

vi.mock('../../src/core/user.ts', () => ({
  default: {
    updateSSCLToken: vi.fn(),
  },
}));

async function loadAuthCore() {
  vi.resetModules();
  return loadModule('../../src/core/auth.ts');
}

function mockRcInfo() {
  vi.mocked(getRcInfo).mockResolvedValue({
    value: {
      cachedData: {
        extensionInfo: {
          id: 'extension-1',
          account: { id: 'account-1' },
          contact: { email: 'user@example.test' },
          permissions: {
            admin: { enabled: true },
          },
        },
      },
    },
  });
}

describe('auth core', () => {
  beforeEach(() => {
    mockRcInfo();
    vi.mocked(getPlatformInfo).mockResolvedValue({
      platformName: 'salesforce',
      hostname: 'crm.example',
      connectorId: 'connector-1',
      isPrivate: false,
    });
    vi.mocked(getManifest).mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        salesforce: {
          name: 'salesforce',
          proxyId: 'proxy-1',
        },
      },
    });
    vi.mocked(setRcAdditionalSubmission).mockResolvedValue({ rcUser: 'Jane Doe' });
    vi.mocked(openDB).mockReset();
    vi.mocked(platformSelectionPage.getPlatformSelectionPageRender).mockClear();
    vi.mocked(authPage.getAuthPageRender).mockClear();
    vi.mocked(managedOAuthSetupPage.getManagedOAuthSetupPageRender).mockClear();
    vi.mocked(managedOAuthMissingPage.getManagedOAuthMissingPageRender).mockClear();
    vi.mocked(tryConnectToBullhorn).mockClear();
    vi.mocked(getPluginConfigurePageRender).mockClear();
    vi.mocked(pluginService.getPluginLicenseStatus).mockReset().mockResolvedValue({
      licenseStatus: true,
      licenseStatusDescription: 'Licensed',
    });
    vi.mocked(embeddableServices.preconfigureServiceManifest).mockClear();
    vi.mocked(adminCore.refreshAdminSettings).mockReset().mockResolvedValue({});
    vi.mocked(adminCore.authAppConnectServer).mockReset();
    vi.mocked(userCore.updateSSCLToken).mockReset();
  });

  it('builds OAuth URLs with default state, encoded values, and plain scopes', async () => {
    const authCore = await loadAuthCore();

    expect(authCore.buildOAuthUrl({
      authorizationUri: 'https://crm.example/oauth',
      clientId: 'client id',
      redirectUri: 'https://redirect.example/callback',
      scopes: 'contacts write',
      platformName: 'salesforce',
    })).toBe(
      'https://crm.example/oauth?response_type=code&client_id=client%20id&scope=contacts%20write&state=platform=salesforce&redirect_uri=https%3A%2F%2Fredirect.example%2Fcallback',
    );
  });

  it('keeps query-style scopes and custom state as-is', async () => {
    const authCore = await loadAuthCore();

    expect(authCore.buildOAuthUrl({
      authorizationUri: 'https://crm.example/oauth',
      clientId: 'client',
      redirectUri: 'https://redirect.example/callback',
      scopes: 'scope=contacts&audience=crm',
      customState: 'custom-state',
      platformName: 'salesforce',
    })).toBe(
      'https://crm.example/oauth?response_type=code&client_id=client&scope=contacts&audience=crm&state=custom-state&redirect_uri=https%3A%2F%2Fredirect.example%2Fcallback',
    );
  });

  it('detects admin-managed OAuth only for enabled OAuth manifests', async () => {
    const authCore = await loadAuthCore();

    expect(authCore.isAdminManagedOAuthEnabled({
      auth: {
        type: 'oauth',
        oauth: {
          adminManaged: { enabled: true },
        },
      },
    })).toBe(true);
    expect(authCore.isAdminManagedOAuthEnabled({ auth: { type: 'oauth', oauth: {} } })).toBe(false);
    expect(authCore.isAdminManagedOAuthEnabled({ auth: { type: 'apiKey' } })).toBe(false);
  });

  it('gets managed OAuth state with RingCentral access token and returns null on failure', async () => {
    const authCore = await loadAuthCore();
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { hasAccountOAuth: true } })
      .mockRejectedValueOnce(new Error('network'));

    await expect(authCore.getManagedOAuthState({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
    })).resolves.toEqual({ hasAccountOAuth: true });
    await expect(authCore.getManagedOAuthState({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
    })).resolves.toBeNull();

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://server.example/oauthManagedAuthState?platform=salesforce&rcAccessToken=rc-access-token');
  });

  it('gets managed API-key auth state with connector and RingCentral identity context', async () => {
    const authCore = await loadAuthCore();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { allRequiredFieldsSatisfied: true } });

    await expect(authCore.getManagedAuthState({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      connectorId: 'connector-1',
      isPrivate: true,
      rcInfo: {
        value: {
          cachedData: {
            extensionInfo: {
              id: 'extension-2',
              account: { id: 'account-2' },
            },
          },
        },
      },
    })).resolves.toEqual({ allRequiredFieldsSatisfied: true });

    expect(axios.get).toHaveBeenCalledWith(
      'https://server.example/apiKeyManagedAuthState?platform=salesforce&connectorId=connector-1&isPrivate=true&rcAccountId=account-2&rcExtensionId=extension-2&rcAccessToken=rc-access-token',
    );
  });

  it('logs in with API key, stores JWT and CRM user info, and updates widget auth status', async () => {
    seedStorage({
      'platform-info': {
        platformName: 'salesforce',
        hostname: 'crm.example',
        connectorId: 'connector-1',
        isPrivate: true,
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        jwtToken: 'jwt-1',
        name: 'CRM User',
        returnMessage: {
          message: 'Authorized',
          messageType: 'success',
          ttl: 3000,
        },
      },
    });
    const authCore = await loadAuthCore();

    await expect(authCore.apiKeyLogin({
      serverUrl: 'https://server.example',
      apiKey: 'api-key',
      formData: { apiUrl: 'https://crm.example/api' },
      useLicense: false,
    })).resolves.toBe('jwt-1');

    expect(axios.post).toHaveBeenCalledWith('https://server.example/apiKeyLogin?state=platform=salesforce', {
      apiKey: 'api-key',
      platform: 'salesforce',
      hostname: 'crm.example',
      proxyId: 'proxy-1',
      rcAccessToken: 'rc-access-token',
      connectorId: 'connector-1',
      isPrivate: true,
      rcAccountId: 'account-1',
      rcExtensionId: 'extension-1',
      userEmail: 'user@example.test',
      additionalInfo: {
        apiUrl: 'https://crm.example/api',
        rcUser: 'Jane Doe',
      },
    });
    expect(readStorage()).toMatchObject({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmUserInfo: { name: 'CRM User' },
    });
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Authorized',
      ttl: 3000,
    });
    expect(trackCrmLogin).toHaveBeenCalled();
    expect(getWidgetPostMessages().map(({ message }) => message.type)).toEqual(expect.arrayContaining([
      'rc-adapter-update-authorization-status',
      'rc-adapter-navigate-to',
    ]));
  });

  it('clears local CRM auth state and Bullhorn-specific state without deleting unrelated storage', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      serverSideLoggingToken: 'ssl-token',
      isAdmin: true,
      crmAuthed: true,
      'platform-info': { platformName: 'bullhorn' },
      crm_extension_bullhornUsername: 'bullhorn-user',
      crm_extension_bullhorn_user_urls: { restUrl: 'https://rest.example' },
      unrelated: 'keep-me',
    });
    const authCore = await loadAuthCore();

    await expect(authCore.clearLocalCrmAuthState()).resolves.toBe(true);

    expect(readStorage()).toEqual({
      'platform-info': { platformName: 'bullhorn' },
      unrelated: 'keep-me',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-update-authorization-status',
        authorized: false,
        authorizedAccount: '',
      },
      targetOrigin: undefined,
    });
  });

  it('syncs crmAuthed from stored JWT presence', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmAuthed: false,
    });
    const authCore = await loadAuthCore();

    await expect(authCore.syncCrmAuthedFromStorage()).resolves.toBe(true);

    expect(readStorage().crmAuthed).toBe(true);
  });

  it('calls unauthorize endpoint and then clears local auth state', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': { platformName: 'salesforce' },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        returnMessage: {
          message: 'Unauthorized',
          messageType: 'success',
          ttl: 3000,
        },
      },
    });
    const authCore = await loadAuthCore();

    await authCore.unAuthorize({ serverUrl: 'https://server.example' });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/unAuthorize');
    expect(trackCrmLogout).toHaveBeenCalled();
    expect(readStorage().rcUnifiedCrmExtJwt).toBeUndefined();
  });

  it('opens OAuth windows for standard, Pipedrive, Bullhorn, and managed OAuth connectors', async () => {
    const authCore = await loadAuthCore();

    await authCore.onUserClickConnectButton({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform: {
        name: 'salesforce',
        auth: {
          type: 'oauth',
          oauth: {
            authUrl: 'https://crm.example/oauth',
            clientId: 'client id',
            scope: 'contacts write',
            redirectUri: 'https://redirect.example/callback',
          },
        },
      },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://crm.example/oauth?response_type=code&client_id=client%20id&scope=contacts%20write&state=platform=salesforce&redirect_uri=https%3A%2F%2Fredirect.example%2Fcallback',
    });

    await authCore.onUserClickConnectButton({
      manifest: {
        serverUrl: 'https://server.example',
        platforms: {
          pipedrive: {
            auth: {
              oauth: {
                redirectUri: 'https://pipedrive.example/auth',
              },
            },
          },
        },
      },
      platformName: 'pipedrive',
      platform: {
        name: 'pipedrive',
        auth: { type: 'oauth', oauth: {} },
      },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://pipedrive.example/auth',
    });

    await authCore.onUserClickConnectButton({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'bullhorn',
      platform: {
        name: 'bullhorn',
        auth: { type: 'oauth', oauth: {} },
      },
    });
    expect(tryConnectToBullhorn).toHaveBeenCalledWith({
      platform: {
        name: 'bullhorn',
        auth: { type: 'oauth', oauth: {} },
      },
    });

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        oauthValues: {
          authorizationUri: 'https://managed.example/oauth',
          clientId: 'managed-client',
          redirectUri: 'https://managed.example/redirect',
          scopes: 'read',
        },
      },
    });
    await authCore.onUserClickConnectButton({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'managed',
      platform: {
        name: 'managed',
        auth: {
          type: 'oauth',
          oauth: {
            adminManaged: { enabled: true },
          },
        },
      },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://managed.example/oauth?response_type=code&client_id=managed-client&scope=read&state=platform=managed&redirect_uri=https%3A%2F%2Fmanaged.example%2Fredirect',
    });
  });

  it('blocks managed OAuth connectors until account OAuth exists', async () => {
    const authCore = await loadAuthCore();
    const platform = {
      auth: {
        type: 'oauth',
        oauth: {
          adminManaged: { enabled: true },
        },
      },
    };
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { hasAccountOAuth: true } })
      .mockResolvedValueOnce({ data: { isAdmin: true, pendingValues: { clientId: 'pending' } } })
      .mockResolvedValueOnce({ data: { isAdmin: false } });

    await expect(authCore.checkManagedOAuthBeforeCrmVisible({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform,
    })).resolves.toEqual({
      blocked: false,
      state: { hasAccountOAuth: true },
    });

    await expect(authCore.checkManagedOAuthBeforeCrmVisible({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform,
    })).resolves.toEqual({
      blocked: true,
      state: { isAdmin: true, pendingValues: { clientId: 'pending' } },
    });
    expect(managedOAuthSetupPage.getManagedOAuthSetupPageRender).toHaveBeenCalledWith({
      platform,
      pendingValues: { clientId: 'pending' },
    });

    await authCore.checkManagedOAuthBeforeCrmVisible({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform,
    });
    expect(managedOAuthMissingPage.getManagedOAuthMissingPageRender).toHaveBeenCalled();
    expect(getWidgetPostMessages().map(({ message }) => message.page?.id)).toEqual(expect.arrayContaining([
      'managedOAuthSetupPage',
      'managedOAuthMissingPage',
    ]));
  });

  it('uses managed API-key auth when all required fields are already satisfied', async () => {
    seedStorage({
      'platform-info': {
        connectorId: 'connector-1',
        isPrivate: true,
        platformName: 'salesforce',
        hostname: 'crm.example',
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { allRequiredFieldsSatisfied: true } });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        jwtToken: 'jwt-1',
        name: 'CRM User',
      },
    });
    vi.mocked(adminCore.refreshAdminSettings).mockResolvedValueOnce({ adminSettings: { userSettings: {} } });
    const authCore = await loadAuthCore();

    await authCore.onUserClickConnectButton({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform: {
        name: 'salesforce',
        useLicense: false,
        auth: { type: 'apiKey' },
      },
    });

    expect(readStorage()).toMatchObject({
      crmAuthed: true,
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    expect(userCore.updateSSCLToken).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: {
        name: 'salesforce',
        useLicense: false,
        auth: { type: 'apiKey' },
      },
      token: 'jwt-1',
    });
    expect(adminCore.authAppConnectServer).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      },
      targetOrigin: '*',
    });
  });

  it('opens API-key auth page when managed fields are not complete', async () => {
    seedStorage({
      'platform-info': {
        connectorId: 'connector-1',
        isPrivate: false,
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        allRequiredFieldsSatisfied: false,
        visibleFieldConsts: ['apiKey'],
      },
    });
    const authCore = await loadAuthCore();

    await authCore.onUserClickConnectButton({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform: {
        name: 'salesforce',
        auth: { type: 'apiKey' },
      },
    });

    expect(authPage.getAuthPageRender).toHaveBeenCalledWith(expect.objectContaining({
      platformName: 'salesforce',
      visibleFieldConsts: ['apiKey'],
      isAdmin: true,
    }));
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/authPage',
      },
      targetOrigin: '*',
    });
  });

  it('opens platform selection when no platform is configured', async () => {
    vi.mocked(getPlatformInfo).mockResolvedValueOnce(null);
    const authCore = await loadAuthCore();

    await authCore.checkAndOpenPlatformSelectionPage({
      platformList: [{ id: 'salesforce', name: 'salesforce' }],
    });

    expect(embeddableServices.preconfigureServiceManifest).toHaveBeenCalled();
    expect(platformSelectionPage.getPlatformSelectionPageRender).toHaveBeenCalledWith({
      platformList: [{ id: 'salesforce', name: 'salesforce' }],
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/platformSelectionPage',
      },
      targetOrigin: '*',
    });
  });

  it('handles plugin OAuth callbacks and returns to plugin configuration page', async () => {
    seedStorage({
      rcUserInfo: { rcExtensionId: 'hashed-ext-1' },
      cachedPluginConfigFormData: {
        pluginId: 'plugin-1',
        access: 'private',
        plugin: { name: 'Plugin' },
        formData: { apiKey: 'secret' },
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { ok: true } });
    const authCore = await loadAuthCore();
    const state = encodeURIComponent(JSON.stringify({
      from: 'plugin',
      redirectTo: 'https://plugin.example/callback',
    }));

    await authCore.onAuthCallback({
      serverUrl: 'https://server.example',
      callbackUri: `https://redirect.example/callback?state=${state}&code=abc`,
      useLicense: false,
    });

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('https://plugin.example/callback?hashedExtensionId=hashed-ext-1&callbackUri='));
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Successfully authorized plugin.',
    });
    expect(pluginService.getPluginLicenseStatus).toHaveBeenCalledWith({
      pluginId: 'plugin-1',
      plugin: { name: 'Plugin' },
    });
    expect(getPluginConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      isLoggedIn: true,
      hasValidLicense: true,
    }));
    expect(readStorage().cachedPluginConfigFormData).toBeUndefined();
  });

  it('handles connector OAuth callbacks, stores JWT, and refreshes license status', async () => {
    localStorage.setItem('sdk-rc-widgetplatform', JSON.stringify({ owner_id: 'ext-1' }));
    seedStorage({
      'platform-info': {
        platformName: 'salesforce',
        hostname: 'crm.example',
      },
    });
    vi.mocked(openDB).mockResolvedValue({
      get: vi.fn(async () => ({
        value: {
          cachedData: {
            extensionInfo: {
              id: 'extension-1',
              account: { id: 'account-1' },
              contact: { email: 'user@example.test' },
            },
          },
        },
      })),
    });
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: {
          jwtToken: 'oauth-jwt',
          name: 'OAuth User',
          returnMessage: { message: 'Authorized' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          isLicenseValid: false,
          licenseStatus: 'Expired',
          licenseStatusDescription: 'Renew license',
        },
      });
    const authCore = await loadAuthCore();

    await expect(authCore.onAuthCallback({
      serverUrl: 'https://server.example',
      callbackUri: 'https://redirect.example/callback?state=platform%3Dsalesforce&code=abc',
      useLicense: true,
    })).resolves.toBe('oauth-jwt');

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://server.example/oauth-callback?callbackUri=https%3A%2F%2Fredirect.example%2Fcallback%3Fstate%3Dplatform%253Dsalesforce%26code%3Dabc&hostname=crm.example&rcAccountId=account-1&proxyId=proxy-1&userEmail=user%40example.test&rcExtensionId=extension-1');
    expect(readStorage()).toMatchObject({
      rcUnifiedCrmExtJwt: 'oauth-jwt',
      crmUserInfo: { name: 'OAuth User' },
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-refresh-license-status',
        licenseStatus: 'License: Expired',
        licenseStatusColor: 'danger.b04',
        licenseDescription: 'Renew license',
      },
      targetOrigin: '*',
    });
  });

  it('checks auth state and exposes license helpers', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmUserInfo: { name: 'CRM User' },
      isAdmin: true,
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        isLicenseValid: true,
        licenseStatus: 'Active',
        licenseStatusDescription: 'Ready',
      },
    });
    const authCore = await loadAuthCore();

    await expect(authCore.checkAuth()).resolves.toBe(true);
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-update-authorization-status',
        authorized: true,
        authorizedAccount: 'CRM User (Admin)',
      },
      targetOrigin: undefined,
    });
    await expect(authCore.getLicenseStatus({ serverUrl: 'https://server.example' })).resolves.toEqual({
      licenseStatus: 'Active',
      licenseStatusColor: 'inherit',
      licenseStatusDescription: 'Ready',
    });
  });
});
