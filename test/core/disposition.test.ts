import axios from 'axios';
import { showNotification, getRcCallLogIdentity } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    put: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(),
  getRcCallLogIdentity: vi.fn(async () => ({
    extensionNumber: '101',
    hashedExtensionId: 'hash-1',
  })),
}));

async function loadDispositionCore() {
  vi.resetModules();
  return loadModule('../../src/core/disposition.ts');
}

describe('disposition core', () => {
  it('upserts call disposition with auth, additional submission, and RingCentral identity', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      rcAdditionalSubmission: {
        account: 'Enterprise',
      },
    });
    vi.mocked(axios.put).mockResolvedValueOnce({
      data: {
        returnMessage: {
          message: 'Disposition updated',
          messageType: 'success',
          ttl: 3000,
        },
      },
    });
    const dispositionCore = await loadDispositionCore();

    await dispositionCore.upsertDisposition({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionId: 'session-1',
      dispositions: { result: 'Demo' },
    });

    expect(getRcCallLogIdentity).toHaveBeenCalled();
    expect(axios.put).toHaveBeenCalledWith('https://server.example/callDisposition', {
      sessionId: 'session-1',
      dispositions: { result: 'Demo' },
      additionalSubmission: { account: 'Enterprise' },
      extensionNumber: '101',
      hashedExtensionId: 'hash-1',
    });
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Disposition updated',
      ttl: 3000,
      details: undefined,
    });
  });

  it('does not call server when JWT is missing', async () => {
    const dispositionCore = await loadDispositionCore();

    await dispositionCore.upsertDisposition({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionId: 'session-1',
      dispositions: { result: 'Demo' },
    });

    expect(axios.put).not.toHaveBeenCalled();
  });
});
