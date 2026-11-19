import adminCore from '../../../../core/admin';
import serverSideLoggingPage from '../../../../components/admin/serverSideLoggingPage';
import { showNotification } from '../../../../lib/util';
import { renderServerSideLoggingSettingPage } from '../../customizedPage/inputChanged/sections/serverSideLoggingSetting';

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

function navigateTo(path: string): void {
  getWidgetFrameWindow().postMessage({ type: 'rc-adapter-navigate-to', path }, '*');
}

// Gives a new URL; the previous one stops logging immediately, so regenerating asks first.
async function rotateUrl({ platform, fromConfirmPage }: { platform: UnknownRecord; fromConfirmPage: boolean }): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    await adminCore.rotateRingCXWebhookUrl({ platform });
    await renderServerSideLoggingSettingPage({ platform, navigate: false });
    if (fromConfirmPage) {
      navigateTo('goBack');
    }
    showNotification({ level: 'success', message: 'RingCX call events URL generated.', ttl: 3000 });
  } catch (e) {
    showNotification({
      level: 'warning',
      message: e instanceof Error && e.message ? e.message : 'Failed to generate the RingCX call events URL.',
      ttl: 5000,
    });
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export async function onEvent({ data, platform }: EventOptions): Promise<void> {
  switch (data.body.button.id) {
    case 'generateRingcxWebhookUrlButton':
      await rotateUrl({ platform, fromConfirmPage: false });
      break;
    case 'regenerateRingcxWebhookUrlButton': {
      const page = serverSideLoggingPage.getRingCXWebhookRotatePageRender();
      getWidgetFrameWindow().postMessage({ type: 'rc-adapter-register-customized-page', page }, '*');
      navigateTo(`/customized/${page.id}`);
      break;
    }
    case 'confirmRingcxWebhookRotateButton':
      await rotateUrl({ platform, fromConfirmPage: true });
      break;
    case 'cancelRingcxWebhookRotateButton':
      navigateTo('goBack');
      break;
    default:
      break;
  }
}

export default {
  onEvent,
};
