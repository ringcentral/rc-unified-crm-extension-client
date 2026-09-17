import adminCore from '../../../../core/admin';
import authPage from '../../../../components/authPage';
import managedAuthUserEditPage from '../../../../components/admin/managedAuthUserEditPage';
import { getRcContactInfo, showNotification } from '../../../../lib/util';
import {
  getCachedManagedAuthOptions,
  getManagedAuthOptionsContextKey,
  setCachedManagedAuthOptions,
} from '../../../../service/managedAuthOptionsService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformName: string;
  fieldConst: string;
  mode: 'auth' | 'user';
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

function getErrorMessage(error: any): string {
  const responseError = error?.response?.data?.error;
  if (typeof responseError === 'string') {
    return responseError;
  }
  if (typeof responseError?.message === 'string') {
    return responseError.message;
  }
  if (typeof error?.message === 'string') {
    return error.message;
  }
  return 'Failed to update the managed authentication list. Please try again.';
}

function getTransientAccountValues({ manifest, platformName, formData }: UnknownRecord): UnknownRecord {
  const fields = manifest?.platforms?.[platformName]?.auth?.apiKey?.page?.content ?? [];
  const accountValues: UnknownRecord = {};
  fields
    .filter((field: UnknownRecord) => field?.managed === true && field?.managedScope === 'account')
    .forEach((field: UnknownRecord) => {
      if (Object.prototype.hasOwnProperty.call(formData, field.const)) {
        accountValues[field.const] = formData[field.const];
      }
    });
  return accountValues;
}

export async function onEvent({ data, manifest, platformName, fieldConst, mode }: EventOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const formData = data.body.button.formData ?? {};
    const platformStorage = await chrome.storage.local.get({ 'platform-info': null }) as UnknownRecord;
    const platformInfo = platformStorage['platform-info'] as UnknownRecord | null;
    const contextKey = getManagedAuthOptionsContextKey({
      platformName,
      connectorId: platformInfo?.connectorId ?? '',
      mode,
    });
    const dynamicOptions = getCachedManagedAuthOptions(contextKey);
    dynamicOptions[fieldConst] = await adminCore.getManagedAuthOptions({
      serverUrl: manifest.serverUrl,
      platformName,
      fieldConst,
      ...(mode === 'auth' ? {
        accountValues: getTransientAccountValues({ manifest, platformName, formData }),
      } : {}),
    });
    setCachedManagedAuthOptions(contextKey, dynamicOptions);

    if (mode === 'auth') {
      const page = authPage.getAuthPageRender({
        manifest,
        platformName,
        isAdmin: true,
        formData,
        dynamicOptions,
      });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page,
      });
      return;
    }

    const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as {
      managedAuthSettings?: UnknownRecord | null;
    };
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const selectedExtension = rcExtensions.find(rc => rc.id === formData.rcExtensionId);
    const page = managedAuthUserEditPage.getManagedAuthUserEditPageRender({
      userFields: managedAuthSettings?.userFields ?? [],
      userValues: managedAuthSettings?.userValues ?? [],
      rcExtension: selectedExtension,
      formData,
      searchWord: formData.searchWord ?? '',
      filter: formData.filter ?? 'All',
      dynamicOptions,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page,
    });
  }
  catch (error) {
    showNotification({
      level: 'error',
      message: getErrorMessage(error),
      ttl: 5000,
    });
  }
  finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
