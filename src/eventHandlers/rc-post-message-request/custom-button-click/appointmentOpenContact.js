import contactCore from '../../../core/contact';

async function onEvent({ data, manifest, platformName, listButtonItemId }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const btn = data.body.button || {};
    const { appointmentsListCache } = await chrome.storage.local.get({ appointmentsListCache: [] });

    const rowId =
      (btn?.additionalInfo?.thirdPartyAppointmentId) ||
      listButtonItemId ||
      btn?.listItem?.const ||
      btn?.value ||
      '';

    const cached = (appointmentsListCache || []).find((a) => {
      const id = a?.thirdPartyAppointmentId ?? a?.id ?? a?.externalId ?? '';
      return String(id) === String(rowId);
    });

    const contactId = btn?.additionalInfo?.contactId ?? cached?.contactId ?? cached?.customerId ?? '';
    const contactType = btn?.additionalInfo?.contactType ?? cached?.contactType ?? 'contact';
    const phoneNumber = btn?.additionalInfo?.phoneNumber ?? cached?.phoneNumber ?? cached?.customerPhone ?? '';
    const contactUrl = btn?.additionalInfo?.contactUrl ?? cached?.contactUrl ?? cached?.customerUrl ?? '';

    if (contactUrl) {
      window.open(contactUrl);
      return;
    }

    // Prefer opening via contactId/type when available, otherwise fallback to phone match.
    if (contactId) {
      await contactCore.openContactPage({ manifest, platformName, contactId, contactType });
      return;
    }

    if (phoneNumber) {
      await contactCore.openContactPage({ manifest, platformName, phoneNumber, multiContactMatchBehavior: 'disabled' });
    }
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

