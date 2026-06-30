import { showNotification } from '../../../lib/util';
import axios from 'axios';
import { renderUrlTemplate } from '../../../lib/urlTemplate';

async function onEvent({ data, manifest, platformName, listButtonItemId }) {
  const btn = data.body.button || {};
  const thirdPartyAppointmentId =
    listButtonItemId ||
    btn?.additionalInfo?.thirdPartyAppointmentId ||
    btn?.formData?.thirdPartyAppointmentId ||
    '';

  // Preferred: use manifest appointment page template when configured.
  const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment;
  const canOpen = !!apptCfg?.canOpenAppointmentPage;
  const template = apptCfg?.appointmentPageUrl;
  if (canOpen && template) {
    const tpl = String(template);
    const values = {};

    if (tpl.includes('{hostname}')) {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      let platformInfo = await chrome.storage.local.get('platform-info');
      if (platformInfo?.['platform-info']?.hostname === 'temp' && rcUnifiedCrmExtJwt) {
        const hostnameRes = await axios.get(`${manifest.serverUrl}/hostname?jwtToken=${rcUnifiedCrmExtJwt}`);
        platformInfo['platform-info'].hostname = hostnameRes.data;
        await chrome.storage.local.set(platformInfo);
      }
      values.hostname = platformInfo?.['platform-info']?.hostname ?? '';
    }

    // {atsUrl} resolves to the Bullhorn user's cluster-specific ATS base URL,
    // Use this instead of hardcoding a cluster domain (e.g. cls91) in the manifest.
    if (tpl.includes('{atsUrl}')) {
      const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
      const atsUrl = crm_extension_bullhorn_user_urls?.atsUrl ?? '';
      values.atsUrl = atsUrl.startsWith('https://') ? atsUrl.slice('https://'.length) : atsUrl;
    }

    if (thirdPartyAppointmentId) {
      values.thirdPartyAppointmentId = encodeURIComponent(String(thirdPartyAppointmentId));
    }
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });

    window.open(renderUrlTemplate({ template: tpl, values, userSettings }).url, '_blank');
    return;
  }

  // Fallback: use appointmentUrl from list/cache if provided by server
  const url = btn?.additionalInfo?.appointmentUrl || btn?.formData?.appointmentUrl || '';
  if (url) {
    window.open(url, '_blank');
    return;
  }
  showNotification({ level: 'warning', message: 'No appointment link available.', ttl: 3000 });
}

exports.onEvent = onEvent;

