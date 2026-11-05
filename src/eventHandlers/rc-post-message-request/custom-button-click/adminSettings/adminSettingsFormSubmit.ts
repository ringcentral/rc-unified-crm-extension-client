import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import doNotContactLib from '../../../../lib/doNotContact';
import { showNotification } from '../../../../lib/util';
import { t } from '../../../../i18n';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
  responseMessage: (requestId: unknown, response: unknown) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

const DO_NOT_CONTACT_KEYS = ['doNotContactRestrictNumbers', 'doNotContactWarnNumbers'];

const DO_NOT_CONTACT_REASON_KEYS: Record<string, string> = {
  characters: 'doNotContact.reasonCharacters',
  noDigit: 'doNotContact.reasonNoDigit',
  wildcardNeedsCountryCode: 'doNotContact.reasonWildcardNeedsCountryCode',
  unparsable: 'doNotContact.reasonUnparsable',
};

// Returns the cleaned form data, or an error message for the first entry that can't be saved.
async function normalizeDoNotContactFormData(formData: UnknownRecord): Promise<{ formData?: UnknownRecord; error?: string }> {
  const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' }) as { selectedRegion: string };
  const cleaned: UnknownRecord = { ...formData };
  for (const key of DO_NOT_CONTACT_KEYS) {
    const { entries, invalid } = doNotContactLib.normalizeEntryList(formData[key]?.value, selectedRegion);
    if (invalid) {
      return {
        error: t('doNotContact.invalidEntry', {
          entry: invalid.entry,
          reason: t(DO_NOT_CONTACT_REASON_KEYS[invalid.reason] ?? 'doNotContact.reasonUnparsable'),
        }),
      };
    }
    cleaned[key] = { value: entries };
  }
  return { formData: cleaned };
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, responseMessage }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  let submittedFormData: UnknownRecord = data.body.button.formData;
  if (data.body.button.id === 'doNotContactPage') {
    const normalized = await normalizeDoNotContactFormData(submittedFormData);
    if (normalized.error) {
      showNotification({ level: 'error', message: normalized.error, ttl: 8000 });
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
      return;
    }
    submittedFormData = normalized.formData!;
  }
  const settingDataKeys = Object.keys(submittedFormData);
  if (!adminSettings.userSettings) {
    adminSettings.userSettings = {};
  }
  for (const k of settingDataKeys) {
    adminSettings.userSettings[k] = submittedFormData[k];
  }

  // Map custom settings override format fields back into overridingNumberFormat object
  if (data.body.button.id === 'customSettingsPage') {
    const f = data.body.button.formData;
    if (f.overridingNumberFormatCustomizable !== undefined || f.overridingNumberFormat1 || f.overridingNumberFormat2 || f.overridingNumberFormat3) {
      adminSettings.userSettings.overridingNumberFormat = {
        customizable: f.overridingNumberFormatCustomizable ?? adminSettings.userSettings?.overridingNumberFormat?.customizable ?? true,
        numberFormatter1: f.overridingNumberFormat1 ?? adminSettings.userSettings?.overridingNumberFormat?.numberFormatter1 ?? '',
        numberFormatter2: f.overridingNumberFormat2 ?? adminSettings.userSettings?.overridingNumberFormat?.numberFormatter2 ?? '',
        numberFormatter3: f.overridingNumberFormat3 ?? adminSettings.userSettings?.overridingNumberFormat?.numberFormatter3 ?? '',
      };
      delete adminSettings.userSettings.overridingNumberFormatCustomizable;
      delete adminSettings.userSettings.overridingNumberFormat1;
      delete adminSettings.userSettings.overridingNumberFormat2;
      delete adminSettings.userSettings.overridingNumberFormat3;
      delete adminSettings.userSettings.overridingNumberFormatTitle;
      delete adminSettings.userSettings.overridingNumberFormatWarning;
    }
  }

  await chrome.storage.local.set({ adminSettings });
  try {
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    await userCore.refreshUserSettings({});
  } catch (error) {
    console.error('Error uploading admin settings:', error);
    showNotification({ level: 'error', message: 'Failed to save settings. Please try again.', ttl: 3000 });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    return;
  }
  const serverSideLoggingEnabled = adminSettings?.userSettings?.serverSideLogging?.enable ?? false;
  if (data.body.button.id === 'callLogDetailsSettingPage' && serverSideLoggingEnabled) {
    // Response to widget to avoid timeout error
    responseMessage(data.requestId, { data: 'ok' });
    let serverSideLoggingSubscribed = false;
    let serverSideLogging: UnknownRecord | undefined;
    try {
      serverSideLogging = await adminCore.getServerSideLogging({ platform });
      serverSideLoggingSubscribed = serverSideLogging?.subscribed ?? false;
    } catch (error) {
      console.error('Error getting server side logging:', error);
    }
    // if server side logging is subscribed, refresh subscription level
    if (serverSideLoggingSubscribed) {
      const useAdminAssignedUserToken = platform.serverSideLogging?.useAdminAssignedUserToken;
      await adminCore.enableServerSideLogging({
        serverUrl: manifest.serverUrl,
        platform,
        subscriptionLevel: serverSideLogging!.subscriptionLevel,
        loggingByAdmin: useAdminAssignedUserToken ? !serverSideLogging!.loggingWithUserAssigned : serverSideLogging!.loggingByAdmin,
        sources: serverSideLogging!.sources,
        silence: true,
      });
    }
  }
  showNotification({ level: 'success', message: 'Settings saved.', ttl: 3000 });
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
}

export default {
  onEvent,
};
