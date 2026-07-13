import { loadModule } from '../helpers/loadModule';
import { seedStorage, readStorage } from '../setup/storageHelpers';

async function loadHandler() {
  vi.resetModules();
  return loadModule('../../src/eventHandlers/rc-sms-settings-notify.js');
}

describe('rc-sms-settings-notify handler', () => {
  it('persists the available sender numbers and captures the direct number once', async () => {
    const handler = await loadHandler();

    await handler.onEvent({
      data: {
        type: 'rc-sms-settings-notify',
        senderNumber: '+16505550001',
        senderNumbers: ['+16505550001', '+18001112222'],
      },
    });

    let storage = readStorage();
    expect(storage.smsSenderNumbers).toEqual(['+16505550001', '+18001112222']);
    expect(storage.smsDefaultSenderNumber).toBe('+16505550001');

    // A later notify (e.g. after the sender was overridden to the shared number)
    // must not overwrite the captured direct number, but should refresh the list.
    await handler.onEvent({
      data: {
        type: 'rc-sms-settings-notify',
        senderNumber: '+18001112222',
        senderNumbers: ['+16505550001', '+18001112222', '+18003334444'],
      },
    });

    storage = readStorage();
    expect(storage.smsDefaultSenderNumber).toBe('+16505550001');
    expect(storage.smsSenderNumbers).toEqual(['+16505550001', '+18001112222', '+18003334444']);
  });

  it('normalizes object-shaped sender numbers and tolerates missing data', async () => {
    const handler = await loadHandler();

    expect(handler.normalizeSenderNumbers([
      '+16505550001',
      { phoneNumber: '+18001112222' },
      { label: 'no-number' },
      null,
    ])).toEqual(['+16505550001', '+18001112222']);
    expect(handler.normalizeSenderNumbers(undefined)).toEqual([]);

    await handler.onEvent({ data: {} });
    const storage = readStorage();
    expect(storage.smsSenderNumbers).toEqual([]);
    expect(storage.smsDefaultSenderNumber).toBeUndefined();
  });
});
