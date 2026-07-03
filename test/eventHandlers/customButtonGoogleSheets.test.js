import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

function manifest() {
  return {
    serverUrl: 'https://server.example',
  };
}

function dataFor(formData = {}, bodyOverrides = {}) {
  return {
    requestId: 'request-1',
    body: {
      button: {
        formData,
      },
      ...bodyOverrides,
    },
  };
}

async function loadGoogleSheetsHandler(modulePath, overrides = {}) {
  vi.resetModules();
  vi.mocked(axios.post).mockReset().mockResolvedValue({
    status: 200,
    data: {
      name: 'Created Sheet',
      url: 'https://sheets.example/created',
    },
  });

  const userCore = {
    refreshUserSettings: vi.fn(async ({ changedSettings } = {}) => ({
      googleSheetsName: changedSettings?.googleSheetsName,
      googleSheetsUrl: changedSettings?.googleSheetsUrl,
    })),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.js', () => ({ default: userCore }));

  const adminCore = {
    uploadAdminSettings: vi.fn(async () => {}),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.js', () => ({ default: adminCore }));

  const util = {
    showNotification: vi.fn(),
    getRcAccessToken: vi.fn(() => 'rc-access-token'),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const googleSheetsPage = {
    renderGoogleSheetsPage: vi.fn(({ userSettings }) => ({ id: 'googleSheetsPage', userSettings })),
    ...overrides.googleSheetsPage,
  };
  vi.doMock('../../src/components/platformSpecific/googleSheetsPage.js', () => ({ default: googleSheetsPage }));

  const adminGoogleSheetsPage = {
    renderAdminGoogleSheetsPage: vi.fn(({ adminSettings }) => ({ id: 'adminGoogleSheetsPage', adminSettings })),
    ...overrides.adminGoogleSheetsPage,
  };
  vi.doMock('../../src/components/admin/adminGoogleSheetsPage.js', () => ({ default: adminGoogleSheetsPage }));

  const handler = await loadModule(modulePath);
  return {
    handler,
    userCore,
    adminCore,
    util,
    googleSheetsPage,
    adminGoogleSheetsPage,
  };
}

describe('custom-button Google Sheets handlers', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      adminSettings: {
        userSettings: {},
      },
    });
  });

  it('opens user Google Sheets config, creates a sheet, selects an existing sheet, and removes it', async () => {
    let loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/googleSheetsConfig.js',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({});
    expect(loaded.googleSheetsPage.renderGoogleSheetsPage).toHaveBeenCalled();

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({ newSheetName: 'New Calls' }),
      manifest: manifest(),
    });
    expect(axios.post).toHaveBeenCalledWith('https://server.example/googleSheets/sheet', {
      name: 'New Calls',
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        googleSheetsName: { value: 'Created Sheet' },
        googleSheetsUrl: { value: 'https://sheets.example/created' },
      },
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'New sheet created successfully',
      ttl: 5000,
    });

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/selectExistingSheetButton.js',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(readStorage().pendingUserGoogleSheetsSelection.timestamp).toEqual(expect.any(Number));
    expect(window.open).toHaveBeenCalledWith('https://server.example/googleSheets/filePicker?token=jwt-1', '_blank');

    seedStorage({
      pendingUserGoogleSheetsSelection: {
        timestamp: Date.now(),
      },
    });
    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({}, {
        sheetName: 'Picked Sheet',
        sheetUrl: 'https://sheets.example/picked',
      }),
      manifest: manifest(),
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        googleSheetsName: { value: 'Picked Sheet' },
        googleSheetsUrl: { value: 'https://sheets.example/picked' },
      },
    });
    expect(readStorage().pendingUserGoogleSheetsSelection).toBeUndefined();
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Google Sheet "Picked Sheet" selected successfully',
      ttl: 3000,
    });

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/removeSheetButton.js',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        googleSheetsName: { value: '' },
        googleSheetsUrl: { value: '' },
      },
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/googleSheetsPage',
        },
      }),
    ]));
  });

  it('handles user Google Sheets warning paths', async () => {
    let loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.js',
    );
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 500,
      data: {},
    });
    await loaded.handler.onEvent({
      data: dataFor({ newSheetName: 'Broken Sheet' }),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Failed to create new sheet',
      ttl: 5000,
    });

    seedStorage({
      pendingUserGoogleSheetsSelection: {
        timestamp: Date.now() - 301000,
      },
    });
    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({}, {
        sheetName: 'Expired Sheet',
        sheetUrl: 'https://sheets.example/expired',
      }),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Sheet selection expired, please try again',
      ttl: 3000,
    });

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.js',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Failed to select sheet',
      ttl: 5000,
    });
  });

  it('creates, selects, and removes admin Google Sheets settings', async () => {
    let loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        newSheetName: 'Admin Calls',
        forceGoogleSheets: {
          customizable: false,
        },
      }),
      manifest: manifest(),
    });
    expect(axios.post).toHaveBeenCalledWith('https://server.example/admin/googleSheets/sheet?rcAccessToken=rc-access-token', {
      name: 'Admin Calls',
    });
    expect(readStorage().adminSettings.userSettings).toMatchObject({
      googleSheetsName: {
        value: 'Created Sheet',
        customizable: false,
      },
      googleSheetsUrl: {
        value: 'https://sheets.example/created',
        customizable: false,
      },
    });
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalled();
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Admin Google Sheet "Created Sheet" created successfully and enforced for all users',
      ttl: 5000,
    });

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminSelectExistingSheetButton.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        forceGoogleSheets: {
          customizable: false,
        },
      }),
      manifest: manifest(),
    });
    expect(readStorage().pendingAdminGoogleSheetsSelection.forceGoogleSheets).toBe(true);
    expect(window.open).toHaveBeenCalledWith('https://server.example/admin/googleSheets/filePicker?jwtToken=jwt-1&rcAccessToken=rc-access-token', '_blank');

    seedStorage({
      pendingAdminGoogleSheetsSelection: {
        forceGoogleSheets: true,
        timestamp: Date.now(),
      },
      adminSettings: {
        userSettings: {},
      },
    });
    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({}, {
        sheetName: 'Picked Admin Sheet',
        sheetUrl: 'https://sheets.example/admin-picked',
      }),
      manifest: manifest(),
    });
    expect(readStorage().adminSettings.userSettings.googleSheetsName).toEqual({
      value: 'Picked Admin Sheet',
      customizable: false,
    });
    expect(readStorage().pendingAdminGoogleSheetsSelection).toBeUndefined();
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Admin Google Sheet "Picked Admin Sheet" selected successfully and enforced for all users',
      ttl: 5000,
    });

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminRemoveSheetButton.js',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(readStorage().adminSettings.userSettings.googleSheetsName).toEqual({
      value: '',
      customizable: true,
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        googleSheetsName: { value: '' },
        googleSheetsUrl: { value: '' },
      },
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Admin Google Sheet removed successfully',
      ttl: 3000,
    });
  });

  it('reports admin Google Sheets selection and creation failures', async () => {
    let loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.js',
    );
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('network'));
    await loaded.handler.onEvent({
      data: dataFor({ newSheetName: 'Broken Admin Sheet' }),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Failed to create new sheet',
      ttl: 5000,
    });

    seedStorage({
      pendingAdminGoogleSheetsSelection: {
        forceGoogleSheets: false,
        timestamp: Date.now() - 301000,
      },
      adminSettings: {
        userSettings: {},
      },
    });
    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.js',
    );
    await loaded.handler.onEvent({
      data: dataFor({}, {
        sheetName: 'Expired Admin Sheet',
        sheetUrl: 'https://sheets.example/expired-admin',
      }),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Sheet selection expired, please try again',
      ttl: 3000,
    });

    loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.js',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Failed to select sheet',
      ttl: 5000,
    });
  });
});
