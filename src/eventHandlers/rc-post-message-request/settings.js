import userCore from '../../core/user';
import { showNotification, responseMessage } from '../../lib/util';
import embeddableServices from '../../service/embeddableServices';
import appointmentsPage from '../../components/appointmentsPage/appointmentsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const changedSettings = {};
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
      changedSettings
    });

    // Re-register Appointments tab so it hides/shows immediately after toggle.
    try {
      const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
      const placeholder = appointmentsPage.getAppointmentsPageRender({
        manifest,
        platformName,
        selectedTab: 'upcoming',
        appointmentTitle: apptCfg?.title ?? 'Appointments',
        showConfirm: apptCfg?.showConfirm !== false,
        userSettings,
      });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: placeholder,
      }, '*');
    } catch (e) { /* ignore */ }
    if (data.body.setting.id === "developerMode") {
      showNotification({ level: 'success', message: `Developer mode is turned ${data.body.setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
      await chrome.storage.local.set({ developerMode: data.body.setting.value });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await embeddableServices.getServiceManifest())
      }, '*');
    }
    else if (data.body.setting.id === "autoOpenWithCRM") {
      showNotification({ level: 'success', message: `Auto open is turned ${data.body.setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
    }
    else {
      showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
    }
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;