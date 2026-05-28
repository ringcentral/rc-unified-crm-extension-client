import { showNotification } from '../../../lib/util';
import axios from 'axios';

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

    let resolvedTpl = tpl;
    if (resolvedTpl.includes('{hostname}')) {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      let platformInfo = await chrome.storage.local.get('platform-info');
      if (platformInfo?.['platform-info']?.hostname === 'temp' && rcUnifiedCrmExtJwt) {
        const hostnameRes = await axios.get(`${manifest.serverUrl}/hostname?jwtToken=${rcUnifiedCrmExtJwt}`);
        platformInfo['platform-info'].hostname = hostnameRes.data;
        await chrome.storage.local.set(platformInfo);
      }
      const hostname = platformInfo?.['platform-info']?.hostname ?? '';
      resolvedTpl = resolvedTpl.replace('{hostname}', hostname);
    }

    // {atsUrl} resolves to the Bullhorn user's cluster-specific ATS base URL,
    // Use this instead of hardcoding a cluster domain (e.g. cls91) in the manifest.
    if (resolvedTpl.includes('{atsUrl}')) {
      const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
      const atsUrl = crm_extension_bullhorn_user_urls?.atsUrl ?? '';
      let sanitizedAtsUrl = atsUrl.startsWith('https://') ? atsUrl.slice('https://'.length) : atsUrl;
      resolvedTpl = resolvedTpl.replace('{atsUrl}', sanitizedAtsUrl);
    }

    const needsId = resolvedTpl.includes('{thirdPartyAppointmentId}');
    const targetUrl = (needsId && thirdPartyAppointmentId)
      ? resolvedTpl.replaceAll('{thirdPartyAppointmentId}', encodeURIComponent(String(thirdPartyAppointmentId)))
      : resolvedTpl;

    window.open(targetUrl, '_blank');
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

