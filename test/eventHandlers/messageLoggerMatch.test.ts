import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

async function loadMatchHandler() {
  vi.resetModules();

  const util: Record<string, any> = {
    responseMessage: vi.fn(),
    isObjectEmpty: vi.fn((obj: any) => !obj || Object.keys(obj).length === 0),
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const logCore: Record<string, any> = {
    getMessageLog: vi.fn(async () => ({ successful: true, messageLogs: {} })),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const matchHandler = await loadModule('../../src/eventHandlers/rc-post-message-request/messageLogger/match/index.ts');
  return { matchHandler, util, logCore };
}

const context = {
  manifest: { serverUrl: 'https://server.example' },
  platformInfo: { platformName: 'salesforce' },
  platformName: 'salesforce',
  platform: {},
};

describe('messageLogger match handler', () => {
  it('reports logged conversations for legacy conversationLogIds requests', async () => {
    seedStorage({
      'rc-crm-conversation-log-c1': { logged: true },
      'rc-crm-conversation-log-c2': {},
    });
    const { matchHandler, util, logCore } = await loadMatchHandler();

    await matchHandler.onEvent({
      data: {
        requestId: 'request-1',
        body: { conversationLogIds: ['c1', 'c2', 'c3'] },
      },
      ...context,
    });

    expect(logCore.getMessageLog).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', {
      data: { c1: [{ id: 'dummyId' }] },
    });
  });

  it('resolves per-message log ids from the server (flat messageId -> logId map)', async () => {
    const { matchHandler, util, logCore } = await loadMatchHandler();
    logCore.getMessageLog.mockResolvedValueOnce({
      successful: true,
      messageLogs: {
        m1: 'crm-entry-1',
        m2: 'crm-entry-2',
      },
    });

    await matchHandler.onEvent({
      data: {
        requestId: 'request-2',
        body: { conversationId: 'conv1', messageIds: ['m1', 'm2', 'm3'] },
      },
      ...context,
    });

    // The server is the source of truth; all requested ids are forwarded.
    expect(logCore.getMessageLog).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      conversationId: 'conv1',
      messageIds: ['m1', 'm2', 'm3'],
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-2', {
      data: {
        m1: { logId: 'crm-entry-1' },
        m2: { logId: 'crm-entry-2' },
      },
    });
  });

  it('tolerates an object-shaped server messageLogs map', async () => {
    const { matchHandler, util, logCore } = await loadMatchHandler();
    logCore.getMessageLog.mockResolvedValueOnce({
      successful: true,
      messageLogs: {
        m1: { logId: 'server-log-1' },
      },
    });

    await matchHandler.onEvent({
      data: {
        requestId: 'request-3',
        body: { conversationId: 'conv2', messageIds: ['m1', 'm2'] },
      },
      ...context,
    });

    expect(util.responseMessage).toHaveBeenCalledWith('request-3', {
      data: { m1: { logId: 'server-log-1' } },
    });
  });

  it('reports nothing logged when the server request fails', async () => {
    const { matchHandler, util, logCore } = await loadMatchHandler();
    logCore.getMessageLog.mockRejectedValueOnce(new Error('network down'));

    await matchHandler.onEvent({
      data: {
        requestId: 'request-4',
        body: { conversationId: 'conv3', messageIds: ['m1', 'm2'] },
      },
      ...context,
    });

    expect(util.responseMessage).toHaveBeenCalledWith('request-4', { data: {} });
  });
});
