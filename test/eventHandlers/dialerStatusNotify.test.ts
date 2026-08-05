import contactCore from '../../src/core/contact.ts';
import { getSchedulePageRender } from '../../src/components/schedulePage.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

vi.mock('../../src/core/contact.ts', () => ({
  default: {
    getLocalCachedContact: vi.fn(),
    getContact: vi.fn(),
  },
}));

vi.mock('../../src/components/schedulePage.ts', () => ({
  getSchedulePageRender: vi.fn(),
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadDialerStatusHandler() {
  vi.resetModules();
  return loadModule('../../src/eventHandlers/rc-dialer-status-notify.ts');
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        contactTypes: ['Lead', 'Contact'],
      },
    },
  };
}

describe('rc-dialer-status-notify event handler', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    vi.mocked(getManifest).mockReset().mockResolvedValue(manifest());
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(contactCore.getLocalCachedContact).mockReset();
    vi.mocked(contactCore.getContact).mockReset();
    vi.mocked(getSchedulePageRender).mockReset().mockReturnValue({ id: 'c2dSchedulePage' });
  });

  it('replays cached click-to-dial requests when the dialer is ready', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      type: 'c2d',
      phoneNumber: '+16505550100',
    });
    const handler = await loadDialerStatusHandler();

    await handler.onEvent({ data: { ready: true } });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'checkForClickToXCache' });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-call',
        phoneNumber: '+16505550100',
        toCall: true,
      },
      targetOrigin: '*',
    });
  });

  it('replays cached click-to-SMS requests with cached contact recipient', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      type: 'c2sms',
      phoneNumber: '+16505550200',
    });
    vi.mocked(contactCore.getLocalCachedContact).mockReturnValueOnce([
      { id: 'contact-1', name: 'Jane Smith' },
    ]);
    const handler = await loadDialerStatusHandler();

    await handler.onEvent({ data: { ready: true } });

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+16505550200',
        conversation: true,
        recipient: { name: 'Jane Smith' },
      },
      targetOrigin: '*',
    });
  });

  it('replays cached click-to-schedule requests by registering the schedule page', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      type: 'c2schedule',
      phoneNumber: '+16505550300',
    });
    vi.mocked(contactCore.getContact).mockResolvedValueOnce({
      contactInfo: [{ id: 'contact-1', name: 'Jane Smith' }],
    });
    const handler = await loadDialerStatusHandler();

    await handler.onEvent({ data: { ready: true } });

    expect(contactCore.getContact).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      phoneNumber: '+16505550300',
      platformName: 'salesforce',
      isForceRefresh: true,
      isToTriggerContactMatch: true,
    });
    expect(getSchedulePageRender).toHaveBeenCalledWith({
      phoneNumber: '+16505550300',
      listOneOf: [
        { const: 'contact-1', title: 'Jane Smith' },
        { const: 'newContact', title: 'Create new contact' },
      ],
      isDefaultNew: false,
      preselect: 'contact-1',
      contactTypes: ['Lead', 'Contact'],
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: { type: 'rc-adapter-register-customized-page', page: { id: 'c2dSchedulePage' } },
      targetOrigin: '*',
    });
  });
});
