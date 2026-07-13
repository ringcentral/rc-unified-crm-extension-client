import axios from 'axios';
import { getPluginList } from '../../../../service/manifestService';
import { getPluginSetting, refreshUserSettings, getAllPluginSettings } from '../../../../core/user';
import { getAdminSettings, uploadAdminSettings } from '../../../../core/admin';
import { getPluginAdminConfigurePageRender } from '../../../../components/pluginAdminConfigurePage';
import { getInstalledPluginListPageRender } from '../../../../components/installedPluginListPage';
import { getPluginMarketListPageRender } from '../../../../components/pluginMarketListPage';
import { getRcAccessTokenHeaderConfig, getRcInfo, showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
  buttonId?: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, buttonId }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const pluginList = await getPluginList() as UnknownRecord[];
    const pluginListToRender: UnknownRecord[] = [];
    let userSettings: UnknownRecord;
    switch (buttonId) {
      case 'installButton':
        const adminSettingsForInstall = await getAdminSettings({ serverUrl: manifest.serverUrl });
        if (!adminSettingsForInstall?.userSettings) {
          adminSettingsForInstall.userSettings = {};
        }
        const config: UnknownRecord = {};
        for (const c of data.body.button.formData.plugin.pageContent) {
          config[c.const] = {
            value: null,
            customizable: c.hidden === true ? false : true,
          };
        }
        adminSettingsForInstall.userSettings[`plugin_${data.body.button.formData.pluginId}`] =
        {
          value: {
            name: data.body.button.formData.plugin.name,
            version: data.body.button.formData.plugin.version,
            isAsync: data.body.button.formData.plugin.isAsync,
            logTypes: data.body.button.formData.plugin.supportedLogTypes,
            access: data.body.button.formData.access,
            requireLicense: data.body.button.formData.plugin.requireLicense,
            config,
          },
          customizable: true,
        };
        await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForInstall });
        try {
          const rcInfo = await getRcInfo();
          const rcAccountId = rcInfo?.value?.cachedData?.accountInfo?.id?.toString()
            || rcInfo?.value?.cachedData?.extensionInfo?.account?.id?.toString();
          await axios.post(`${manifest.serverUrl}/plugin/register`, {
            pluginId: data.body.button.formData.pluginId,
            pluginAccess: data.body.button.formData.access,
            pluginName: data.body.button.formData.plugin.name,
            rcAccountId,
            ownerRcAccountId: data.body.button.formData.ownerRcAccountId,
          }, getRcAccessTokenHeaderConfig());
        } catch (registerError) {
          adminSettingsForInstall.userSettings[`plugin_${data.body.button.formData.pluginId}`].isRemoved = true;
          await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForInstall });
          throw registerError;
        }
        userSettings = await refreshUserSettings({});
        // Refresh detail config page to installed state
        const pluginConfigurePageRender = getPluginAdminConfigurePageRender({
          pluginId: data.body.button.formData.pluginId,
          pluginAccess: data.body.button.formData.access,
          plugin: data.body.button.formData.plugin,
          ownerRcAccountId: data.body.button.formData.ownerRcAccountId,
          installed: true,
        });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-register-customized-page',
          page: pluginConfigurePageRender,
        });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-navigate-to',
          path: `/customized/${pluginConfigurePageRender.id}`,
        }, '*');
        // Refresh market page
        for (const plugin of pluginList) {
          if (getPluginSetting(userSettings, plugin.id)) {
            continue;
          }
          pluginListToRender.push(plugin);
        }
        const pluginMarketPageRender = getPluginMarketListPageRender({
          pluginList: pluginListToRender,
          searchWord: '',
          filter: null,
        });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-register-customized-page',
          page: pluginMarketPageRender,
        });

        // Refresh installed plugin list page
        const installedPlugins = getAllPluginSettings(userSettings);
        const installedPluginsToRender: UnknownRecord[] = [];
        for (const pluginId in installedPlugins) {
          const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
          if (targetPlugin) {
            installedPluginsToRender.push(targetPlugin);
          }
        }
        const installedPluginListPageRender = getInstalledPluginListPageRender({ pluginList: installedPluginsToRender, isFromAdmin: true });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-register-customized-page',
          page: installedPluginListPageRender,
        });
        break;
      case 'removeButton':
        const adminSettingsForRemove = await getAdminSettings({ serverUrl: manifest.serverUrl });
        adminSettingsForRemove.userSettings[`plugin_${data.body.button.formData.pluginId}`].isRemoved = true;
        await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForRemove });
        try {
          const rcInfo = await getRcInfo();
          const rcAccountId = rcInfo?.value?.cachedData?.accountInfo?.id?.toString()
            || rcInfo?.value?.cachedData?.extensionInfo?.account?.id?.toString();
          await axios.delete(`${manifest.serverUrl}/plugin/unregister`, getRcAccessTokenHeaderConfig({
            params: {
              rcAccountId,
              pluginName: data.body.button.formData.plugin.name,
              pluginId: data.body.button.formData.pluginId,
            },
          }));
        }
        catch (unregisterError) {
          console.error(unregisterError);
          throw unregisterError;
        }
        userSettings = await refreshUserSettings({ settingKeysToRemove: [`plugin_${data.body.button.formData.pluginId}`] });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-navigate-to',
          path: 'goBack',
        }, '*');
        for (const pluginId in getAllPluginSettings(userSettings)) {
          const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
          if (targetPlugin) {
            pluginListToRender.push(targetPlugin);
          }
        }
        // Refresh installed plugin list page
        const pluginListPageRender = getInstalledPluginListPageRender({ pluginList: pluginListToRender, isFromAdmin: true });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-register-customized-page',
          page: pluginListPageRender,
        });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-navigate-to',
          path: `/customized/${pluginListPageRender.id}`,
        }, '*');
        break;
    }
  } catch (e) {
    showNotification({
      level: 'error',
      message: (e as UnknownRecord).response?.data?.returnMessage || (e as Error).message || 'Plugin installation failed.',
      ttl: 5000,
    });
    console.error(e);
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
