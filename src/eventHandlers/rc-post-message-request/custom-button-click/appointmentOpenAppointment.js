import { showNotification } from '../../../lib/util';

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
  if (canOpen && template && thirdPartyAppointmentId) {
    const targetUrl = String(template).replaceAll('{thirdPartyAppointmentId}', encodeURIComponent(String(thirdPartyAppointmentId)));
    window.open(targetUrl, '_blank');
    return;
  }

  // Fallback: use appointmentUrl from list/cache if provided by server
  const url = btn?.additionalInfo?.appointmentUrl || btn?.formData?.appointmentUrl || '';
  if (url) {
    window.open(url, '_blank');
    return;
  }
  // Attempt to resolve from cache
  const { appointmentsListCache = [] } = await chrome.storage.local.get('appointmentsListCache');
  const appt = (appointmentsListCache || []).find(a => String(a.thirdPartyAppointmentId ?? a.id ?? a.externalId ?? '') === String(thirdPartyAppointmentId));
  const cachedUrl = appt?.appointmentUrl ?? appt?.externalUrl ?? appt?.url ?? '';
  if (cachedUrl) {
    window.open(cachedUrl, '_blank');
    return;
  }
  showNotification({ level: 'warning', message: 'No appointment link available.', ttl: 3000 });
}

exports.onEvent = onEvent;

