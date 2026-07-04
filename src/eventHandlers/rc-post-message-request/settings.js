import userCore from '../../core/user';
import { showNotification, responseMessage } from '../../lib/util';
import embeddableServices from '../../service/embeddableServices';
import appointmentsPage from '../../components/appointmentsPage/appointmentsPage';
import i18n from '../../i18n';
import { syncLocaleToEmbeddable } from '../../lib/embeddableLocale';
import { refreshLocalizedCustomizedPageTitles } from '../../service/customizedPageLocaleService';

function findSettingValue(setting, settingId) {
    if (!setting) {
      return undefined;
    }
    if (setting.id === settingId && setting.value !== undefined) {
      return setting.value;
    }
    if (!Array.isArray(setting.items)) {
      return undefined;
    }
    for (const item of setting.items) {
      const value = findSettingValue(item, settingId);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
}

function getLanguageSettingValue(body) {
    const settingValue = findSettingValue(body?.setting, 'language');
    if (settingValue !== undefined) {
      return settingValue;
    }
    if (!Array.isArray(body?.settings)) {
      return undefined;
    }
    for (const setting of body.settings) {
      const value = findSettingValue(setting, 'language');
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
}

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const selectedLanguageSetting = getLanguageSettingValue(data.body);
    if (selectedLanguageSetting !== undefined) {
      // Language is stored locally (works even before CRM auth) and takes precedence over the RingCentral region.
      const selectedLanguage = selectedLanguageSetting ?? 'auto';
      await chrome.storage.local.set({ languageOverride: selectedLanguage });
      let locale;
      if (selectedLanguage === 'auto') {
        const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
        locale = await i18n.init(selectedRegion);
      }
      else {
        locale = await i18n.applyLocaleCode(selectedLanguage);
      }
      await syncLocaleToEmbeddable(locale);
      // Re-register the service so all UI strings refresh in the newly selected language.
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await embeddableServices.getServiceManifest())
      }, '*');
      await refreshLocalizedCustomizedPageTitles();
      showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
      responseMessage(data.requestId, { data: 'ok' });
      return;
    }

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
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
          type: 'rc-adapter-register-customized-page',
          page: placeholder,
        }, '*');
      }
    } catch (e) { /* ignore */ }
    if (data.body.setting?.id === "developerMode") {
      showNotification({ level: 'success', message: `Developer mode is turned ${data.body.setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
      await chrome.storage.local.set({ developerMode: data.body.setting.value });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await embeddableServices.getServiceManifest())
      }, '*');
    }
    else if (data.body.setting?.id === "autoOpenWithCRM") {
      showNotification({ level: 'success', message: `Auto open is turned ${data.body.setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
    }
    else {
      showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
    }
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;
