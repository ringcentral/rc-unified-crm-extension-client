import adminCore from '../../../../../core/admin';
import extensionAdoptionPage from '../../../../../components/admin/extensionAdoptionPage';
import { RcAPI } from '../../../../../lib/rcAPI';
import { getRcAccessToken, refreshRCToken } from '../../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function loadRcExtensions(): Promise<UnknownRecord[] | null> {
  try {
    await refreshRCToken();
    return await new RcAPI().getRcExtensionList({ rcAccessToken: getRcAccessToken() });
  }
  catch (e) {
    // The two adoption numbers do not depend on the RingCentral directory; show N/A for the total instead.
    console.log('Cannot load RingCentral extension list for adoption stats', e);
    return null;
  }
}

// Read-only "Extension adoption" section of the Admin tab. Data collection happens on
// the connector server (GET /userInfoHash); this only displays the aggregated numbers.
export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const [stats, rcExtensions] = await Promise.all([
      adminCore.getExtensionAdoptionStats({ serverUrl: manifest?.serverUrl }),
      loadRcExtensions(),
    ]);
    const extensionAdoptionPageRender = extensionAdoptionPage.getExtensionAdoptionPageRender({
      stats: stats as { installedCount: number; connectedCount: number; lastActiveAt: string | null } | null,
      rcExtensions,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: extensionAdoptionPageRender,
    }, '*');
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${extensionAdoptionPageRender.id}`, // page id
    }, '*');
  }
  finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
