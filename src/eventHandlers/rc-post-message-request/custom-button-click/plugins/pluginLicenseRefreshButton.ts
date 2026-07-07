import pluginService from '../../../../service/pluginService';
import { getMergedPluginConfigFromFormData, getPluginConfigurePageRender } from '../../../../components/pluginConfigurePage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const pluginId = data.body.button.formData.pluginId;
    const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ pluginId, plugin: data.body.button.formData.plugin });
    const pluginConfigurePageRender = getPluginConfigurePageRender({
      pluginId,
      pluginAccess: data.body.button.formData.access,
      plugin: data.body.button.formData.plugin,
      config: getMergedPluginConfigFromFormData(data.body.button.formData),
      isLoggedIn: data.body.button.formData.isLoggedIn,
      hasValidLicense: licenseStatus,
      licenseStatusDescription,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: pluginConfigurePageRender,
    });
  }
  catch (error) {
    console.error(error);
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
