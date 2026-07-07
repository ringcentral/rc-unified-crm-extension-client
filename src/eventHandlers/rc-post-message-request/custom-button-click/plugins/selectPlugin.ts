import axios from 'axios';
import { getPluginAdminConfigurePageRender } from '../../../../components/pluginAdminConfigurePage';
import { getPluginConfigurePageRender } from '../../../../components/pluginConfigurePage';
import { getUserSettingsOnline, getPluginSetting } from '../../../../core/user';
import { checkAuth } from '../../../../core/auth';
import { showNotification } from '../../../../lib/util';
import { getPluginDetails } from '../../../../service/manifestService';
import pluginService from '../../../../service/pluginService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
  listButtonItemId?: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const isAuthorized = await checkAuth();
  if (!isAuthorized) {
    showNotification({ level: 'warning', message: `Please go to user settings page and connect to your ${manifest.platforms[platformName].displayName} account.`, ttl: 5000 });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    return;
  }
  const resolvedListButtonItemId = listButtonItemId ?? data.body.formData.plugins;
  const selectedPluginId = resolvedListButtonItemId.split('=')[0];
  const selectedPluginAccess = resolvedListButtonItemId.split('=')[1];
  const formData = data.body?.button?.formData ?? data.body.formData;
  const selectedPlugin = formData.pluginList.find((plugin: UnknownRecord) => plugin.id === selectedPluginId);
  const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
  const pluginSetting = getPluginSetting(userSettings, selectedPluginId);
  const installed = !!pluginSetting;
  const plugin = await getPluginDetails({ selectedPlugin }) as UnknownRecord;
  const configSetting = pluginSetting?.config ?? {};
  let isLoggedIn = false;
  if (plugin?.showAuthorizationButton && plugin?.authStateUrl) {
    try {
      const authResponse = await axios.get(`${plugin.authStateUrl}`);
      isLoggedIn = authResponse.data.successful;
      if (authResponse.data.returnMessage) {
        showNotification({ level: authResponse.data.returnMessage.messageType, message: authResponse.data.returnMessage.message, ttl: 3000 });
      }
    }
    catch (error) {
      console.error(error);
      if ((error as UnknownRecord).response?.data?.returnMessage) {
        showNotification({ level: (error as UnknownRecord).response.data.returnMessage.messageType, message: (error as UnknownRecord).response.data.returnMessage.message, ttl: 3000 });
      }
      isLoggedIn = false;
    }
  }
  const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ pluginId: selectedPluginId, plugin });
  const pluginConfigurePageRender = formData.isFromAdmin ?
    getPluginAdminConfigurePageRender({
      pluginId: selectedPluginId,
      pluginAccess: selectedPluginAccess,
      plugin,
      ownerRcAccountId: selectedPlugin.accountId,
      installed,
    }) :
    getPluginConfigurePageRender({
      pluginId: selectedPluginId,
      pluginAccess: selectedPluginAccess,
      plugin,
      config: configSetting,
      isLoggedIn,
      hasValidLicense: licenseStatus,
      licenseStatusDescription,
    });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: pluginConfigurePageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${pluginConfigurePageRender.id}`,
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
