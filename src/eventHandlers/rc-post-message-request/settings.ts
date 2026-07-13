import userCore from '../../core/user';
import { showNotification, responseMessage } from '../../lib/util';
import embeddableServices from '../../service/embeddableServices';
import appointmentsPage from '../../components/appointmentsPage/appointmentsPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  const changedSettings: UnknownRecord = {};
  for (const s of data.body.settings) {
    if (s.items !== undefined) {
      for (const i of s.items) {
        if (i?.items !== undefined) {
          for (const ii of i.items) {
            changedSettings[ii.id] = { value: ii.value };
          }
        } else {
          changedSettings[i.id] = { value: i.value };
        }
      }
    }
    else if (s.value !== undefined) {
      changedSettings[s.id] = { value: s.value };
    }
  }
  const userSettings = await userCore.refreshUserSettings({
    changedSettings,
  });

  // Re-register Appointments tab so it hides/shows immediately after toggle.
  // Only do this when the manifest explicitly enables appointment support.
  try {
    const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
    if (apptCfg.supported) {
      const placeholder = appointmentsPage.getAppointmentsPageRender({
        manifest,
        platformName,
        selectedTab: 'upcoming',
        appointmentTitle: apptCfg?.title ?? 'Appointments',
        showConfirm: apptCfg?.showConfirm !== false,
        userSettings,
      });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: placeholder,
      }, '*');
    }
  } catch (e) { void e; /* ignore */ }
  const setting = data.body.setting;
  if (setting?.id === 'developerMode') {
    showNotification({ level: 'success', message: `Developer mode is turned ${setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
    await chrome.storage.local.set({ developerMode: setting.value });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-third-party-service',
      service: (await embeddableServices.getServiceManifest()),
    }, '*');
  }
  else if (setting?.id === 'autoOpenWithCRM') {
    showNotification({ level: 'success', message: `Auto open is turned ${setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
  }
  else {
    showNotification({ level: 'success', message: 'Settings saved.', ttl: 3000 });
  }
  responseMessage(data.requestId, { data: 'ok' });
}

export default {
  onEvent,
};
