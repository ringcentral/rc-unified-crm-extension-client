import axios from 'axios';
import feedbackPage from '../../src/components/feedbackPage.ts';
import supportPage from '../../src/components/supportPage.ts';
import { trackOpenFeedback } from '../../src/lib/analytics.ts';
import { getRcInfo } from '../../src/lib/util.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/components/feedbackPage.ts', () => ({
  default: {
    getFeedbackPageRender: vi.fn(),
  },
}));

vi.mock('../../src/components/supportPage.ts', () => ({
  default: {
    getSupportPageRender: vi.fn(),
  },
}));

vi.mock('../../src/lib/analytics.ts', () => ({
  trackOpenFeedback: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcInfo: vi.fn(),
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadNavigateHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/navigate.ts');
}

describe('navigate message handler', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(feedbackPage.getFeedbackPageRender).mockReset().mockReturnValue({ id: 'feedbackPage' });
    vi.mocked(supportPage.getSupportPageRender).mockReset().mockReturnValue({ id: 'supportPage' });
    vi.mocked(trackOpenFeedback).mockReset();
    vi.mocked(getRcInfo).mockReset().mockResolvedValue({
      value: {
        cachedData: {
          extensionInfo: {
            account: { id: 12345 },
          },
        },
      },
    });
    vi.mocked(getManifest).mockReset().mockResolvedValue({
      serverUrl: 'https://server.example',
      version: '1.7.35',
      platforms: {
        salesforce: {
          page: {
            feedback: { enabled: true },
          },
        },
      },
    });
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
  });

  it('navigates directly for ordinary widget paths', async () => {
    const sendResponse = vi.fn();
    const handler = await loadNavigateHandler();

    await handler.onMessage({ request: { path: '/dialer' }, sendResponse });

    expect(getWidgetPostMessages()).toContainEqual({
      message: { type: 'rc-adapter-navigate-to', path: '/dialer' },
      targetOrigin: '*',
    });
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('registers the feedback page and tracks the open event', async () => {
    const handler = await loadNavigateHandler();

    await handler.onMessage({ request: { path: '/feedback' }, sendResponse: vi.fn() });

    expect(feedbackPage.getFeedbackPageRender).toHaveBeenCalledWith({
      pageConfig: { enabled: true },
      version: '1.7.35',
    });
    expect(trackOpenFeedback).toHaveBeenCalled();
    expect(getWidgetPostMessages()).toContainEqual({
      message: { type: 'rc-adapter-navigate-to', path: '/customized/feedbackPage' },
      targetOrigin: '*',
    });
  });

  it('builds the support page with service health and RingCentral account context', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200 });
    const handler = await loadNavigateHandler();

    await handler.onMessage({ request: { path: '/support' }, sendResponse: vi.fn() });

    expect(supportPage.getSupportPageRender).toHaveBeenCalledWith({
      manifest: expect.objectContaining({ serverUrl: 'https://server.example' }),
      platformName: 'salesforce',
      isOnline: true,
      rcAccountId: 12345,
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: { type: 'rc-adapter-navigate-to', path: '/customized/supportPage' },
      targetOrigin: '*',
    });
  });
});
