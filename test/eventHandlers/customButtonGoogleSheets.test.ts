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
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const adminCore = {
    uploadAdminSettings: vi.fn(async () => {}),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.ts', () => ({ default: adminCore }));

  const util = {
    showNotification: vi.fn(),
    getRcAccessToken: vi.fn(() => 'rc-access-token'),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const googleSheetsPage = {
    renderGoogleSheetsPage: vi.fn(({ userSettings }) => ({ id: 'googleSheetsPage', userSettings })),
    ...overrides.googleSheetsPage,
  };
  vi.doMock('../../src/components/platformSpecific/googleSheetsPage.ts', () => ({ default: googleSheetsPage }));

  const adminGoogleSheetsPage = {
    renderAdminGoogleSheetsPage: vi.fn(({ adminSettings }) => ({ id: 'adminGoogleSheetsPage', adminSettings })),
    ...overrides.adminGoogleSheetsPage,
  };
  vi.doMock('../../src/components/admin/adminGoogleSheetsPage.ts', () => ({ default: adminGoogleSheetsPage }));

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

  it('opens the user Google Sheets config page with refreshed settings', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/googleSheetsConfig.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({});
    expect(loaded.googleSheetsPage.renderGoogleSheetsPage).toHaveBeenCalled();
  });

  it('creates a user Google Sheet and stores the created sheet settings', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.ts',
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
  });

  it('starts user Google Sheet picker flow', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/selectExistingSheetButton.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(readStorage().pendingUserGoogleSheetsSelection.timestamp).toEqual(expect.any(Number));
    expect(window.open).toHaveBeenCalledWith('https://server.example/googleSheets/filePicker?token=jwt-1', '_blank');
  });

  it('stores a picked user Google Sheet and clears pending selection state', async () => {
    seedStorage({
      pendingUserGoogleSheetsSelection: {
        timestamp: Date.now(),
      },
    });
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.ts',
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
  });

  it('removes user Google Sheet settings and returns to the config page', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/removeSheetButton.ts',
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

  it('warns when user Google Sheet creation returns a non-success response', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.ts',
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
  });

  it('warns when a picked user Google Sheet arrives after selection state expires', async () => {
    seedStorage({
      pendingUserGoogleSheetsSelection: {
        timestamp: Date.now() - 301000,
      },
    });
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.ts',
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
  });

  it('warns when user Google Sheet selection is missing sheet details', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.ts',
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

  it('creates an enforced admin Google Sheet and persists admin settings', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.ts',
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
  });

  it('starts enforced admin Google Sheet picker flow', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminSelectExistingSheetButton.ts',
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
  });

  it('stores a picked enforced admin Google Sheet and clears pending selection state', async () => {
    seedStorage({
      pendingAdminGoogleSheetsSelection: {
        forceGoogleSheets: true,
        timestamp: Date.now(),
      },
      adminSettings: {
        userSettings: {},
      },
    });
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.ts',
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
  });

  it('removes admin Google Sheet settings and clears user settings', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminRemoveSheetButton.ts',
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

  it('warns when admin Google Sheet creation fails', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.ts',
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
  });

  it('warns when a picked admin Google Sheet arrives after selection state expires', async () => {
    seedStorage({
      pendingAdminGoogleSheetsSelection: {
        forceGoogleSheets: false,
        timestamp: Date.now() - 301000,
      },
      adminSettings: {
        userSettings: {},
      },
    });
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.ts',
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
  });

  it('warns when admin Google Sheet selection is missing sheet details', async () => {
    const loaded = await loadGoogleSheetsHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.ts',
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
