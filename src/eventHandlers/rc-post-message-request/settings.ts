import userCore from '../../core/user';
import { showNotification, responseMessage } from '../../lib/util';
import embeddableServices from '../../service/embeddableServices';
import appointmentsPage from '../../components/appointmentsPage/appointmentsPage';
import reportPage from '../../components/reportPage/reportPage';
import calldownPage from '../../components/calldownPage';
import adminPage from '../../components/admin/adminPage';
import i18n from '../../i18n';
import { syncLocaleToEmbeddableWhenReady } from '../../lib/embeddableLocale';

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

  // Detect a UI language change. The widget echoes the FULL settings tree on
  // every save, so `changedSettings.language` is present on every save and the
  // specific `data.body.setting` may not surface nested options. We therefore
  // compare the submitted language against the value we last applied
  // (`languageOverride` in local storage) and only act when it actually changed.
  // `languageOverride` is stored locally (not just in server userSettings) so the
  // choice survives even if the server strips unknown keys, works before CRM auth,
  // and is not reverted by later restoreLocale() calls (e.g. region-settings).
  const languageChanged = await maybeApplyLanguageChange({ changedSettings, manifest, platformName, userSettings });

  const setting = data.body.setting;
  // `autoLogSMS` and `selectedMessageLog` are mutually exclusive in the settings
  // UI. Re-register the service so the now-hidden/shown item updates immediately
  // after the toggle instead of only on the next reload.
  if (setting?.id === 'autoLogSMS' || setting?.id === 'selectedMessageLog') {
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-third-party-service',
      service: (await embeddableServices.getServiceManifest()),
    }, '*');
  }
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
  else if (languageChanged) {
    showNotification({ level: 'success', message: 'Language updated.', ttl: 3000 });
  }
  else {
    showNotification({ level: 'success', message: 'Settings saved.', ttl: 3000 });
  }
  responseMessage(data.requestId, { data: 'ok' });
}

async function maybeApplyLanguageChange({ changedSettings, manifest, platformName, userSettings }: UnknownRecord): Promise<boolean> {
  const submittedLanguage = changedSettings?.language?.value;
  if (submittedLanguage === undefined) {
    return false;
  }
  const { languageOverride: previousLanguageOverride } = await chrome.storage.local.get({
    languageOverride: i18n.AUTO_LOCALE,
  });
  if (submittedLanguage === previousLanguageOverride) {
    return false;
  }
  // Persist the user's explicit choice locally so it takes priority over the
  // browser/region language everywhere (popup, content script, root).
  await chrome.storage.local.set({ languageOverride: submittedLanguage });
  const localeCode = submittedLanguage && submittedLanguage !== i18n.AUTO_LOCALE
    ? i18n.normalizeLocaleCode(submittedLanguage)
    : i18n.getBrowserLocale();
  await i18n.applyLocaleCode(localeCode);
  await syncLocaleToEmbeddableWhenReady(localeCode);
  // Re-register the service so all setting labels re-render in the new language.
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-third-party-service',
    service: (await embeddableServices.getServiceManifest()),
  }, '*');
  // The service re-registration above only re-renders settings pages. The custom
  // tabs (Reports, Call Back, Admin) are registered separately at login and are
  // NOT covered by it, so their titles would stay in the previous language until
  // a full reload. Re-register them here so they localize immediately.
  await reRegisterLocalizedCustomizedTabs({ manifest, platformName, userSettings });
  return true;
}

// Re-registers the extension-owned custom tabs so their `t()`-based titles pick
// up the newly applied locale without requiring a reload. Each tab is guarded by
// the same "show tab" conditions used at login, and rendered from already-known
// state (no network calls). Failures are isolated so one tab cannot block others.
async function reRegisterLocalizedCustomizedTabs({ manifest, platformName, userSettings }: UnknownRecord): Promise<void> {
  const widget = getWidgetFrameWindow();

  // Reports tab
  try {
    if (userCore.getShowUserReportTabSetting(userSettings)?.value) {
      const userStats = await userCore.getUserReportStats({ dateRange: 'Last 24 hours' });
      widget.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: reportPage.getReportsPageRender({ userStats, userSettings }),
      }, '*');
    }
  } catch (e) { void e; }

  // Call Back (calldown) tab
  try {
    if (userCore.getShowCalldownTabSetting(userSettings)?.value) {
      const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
      widget.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: calldownPageRender,
      }, '*');
    }
  } catch (e) { void e; }

  // Admin tab (only for admins). Re-render from stored settings to avoid a
  // network round-trip on every language change.
  try {
    const { isAdmin, adminSettings } = await chrome.storage.local.get({ isAdmin: false, adminSettings: null });
    if (isAdmin && adminSettings) {
      const platform = manifest?.platforms?.[platformName];
      widget.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminPage.getAdminPageRender({ platform }),
      }, '*');
    }
  } catch (e) { void e; }
}

export default {
  onEvent,
};
