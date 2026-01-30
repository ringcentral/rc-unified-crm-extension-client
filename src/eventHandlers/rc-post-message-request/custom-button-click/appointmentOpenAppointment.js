import { showNotification } from '../../../lib/util';

async function onEvent({ data, listButtonItemId }) {
  const btn = data.body.button || {};
  const url = btn?.additionalInfo?.appointmentUrl || btn?.formData?.appointmentUrl || '';
  if (url) {
    window.open(url, '_blank');
    return;
  }
  // Attempt to resolve from cache
  const { appointmentsListCache = [] } = await chrome.storage.local.get('appointmentsListCache');
  const appt = (appointmentsListCache || []).find(a => String(a.id ?? a.appointmentId ?? a.externalId ?? '') === String(listButtonItemId));
  const cachedUrl = appt?.appointmentUrl ?? appt?.externalUrl ?? appt?.url ?? '';
  if (cachedUrl) {
    window.open(cachedUrl, '_blank');
    return;
  }
  showNotification({ level: 'warning', message: 'No appointment link available.', ttl: 3000 });
}

exports.onEvent = onEvent;

