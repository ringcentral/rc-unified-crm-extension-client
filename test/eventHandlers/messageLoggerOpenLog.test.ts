import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

async function loadOpenLogHandler() {
  vi.resetModules();

  const util: Record<string, any> = {
    responseMessage: vi.fn(),
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const logCore: Record<string, any> = {
    openLog: vi.fn(),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const openLogHandler = await loadModule('../../src/eventHandlers/rc-post-message-request/messageLogger/openLog/index.ts');
  return { openLogHandler, util, logCore };
}

const manifest = {
  serverUrl: 'https://server.example',
  platforms: { salesforce: { logPageUrl: 'https://{hostname}/log/{logId}' } },
};

const context = {
  manifest,
  platformInfo: { platformName: 'salesforce', hostname: 'crm.example' },
  platformName: 'salesforce',
  platform: {},
};

describe('messageLogger openLog handler', () => {
  it('opens the CRM log record for a message logged icon click', async () => {
    seedStorage({ userSettings: { some: 'setting' } });
    const { openLogHandler, util, logCore } = await loadOpenLogHandler();

    await openLogHandler.onEvent({
      data: {
        requestId: 'request-1',
        body: { logId: 'log-42', contactId: 'contact-1', contactType: 'Lead' },
      },
      ...context,
    });

    expect(logCore.openLog).toHaveBeenCalledWith({
      manifest,
      platformName: 'salesforce',
      hostname: 'crm.example',
      logId: 'log-42',
      contactId: 'contact-1',
      contactType: 'Lead',
      userSettings: { some: 'setting' },
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('acknowledges without opening when no logId is provided', async () => {
    seedStorage({ userSettings: {} });
    const { openLogHandler, util, logCore } = await loadOpenLogHandler();

    await openLogHandler.onEvent({
      data: { requestId: 'request-2', body: {} },
      ...context,
    });

    expect(logCore.openLog).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-2', { data: 'ok' });
  });
});
