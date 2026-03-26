import contactCore from '../../../../core/contact';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const btn = data.body.button || {};
    const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] });
    const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
    const item = (calldownListCache || []).find(i => i.id === rowId) || { contactId: btn?.additionalInfo?.contactId, contactType: btn?.additionalInfo?.contactType, phoneNumber: btn?.additionalInfo?.phoneNumber };
    // Prefer resolving by phone to get a reliable contact type, then select the specific contactId
    if (item?.contactId && item?.phoneNumber) {
      const { matched, contactInfo } = await contactCore.getContact({
        serverUrl: manifest.serverUrl,
        phoneNumber: item.phoneNumber,
        platformName,
        isForceRefresh: true,
        isToTriggerContactMatch: false
      });
      if (matched) {
        const realContacts = (contactInfo || []).filter(c => !c.isNewContact);
        const exact = realContacts.find(c => c.id == item.contactId);
        if (exact) {
          await contactCore.openContactPage({ manifest, platformName, contactId: exact.id, contactType: exact.type });
        }
      }
      // Fallback if not found from phone match
      else if (item.contactType) {
        await contactCore.openContactPage({ manifest, platformName, contactId: item.contactId, contactType: item.contactType });
      }
    }
    else if (item?.phoneNumber) {
      // Resolve by phone; open the first non-new matched contact directly
      const { matched, contactInfo } = await contactCore.getContact({
        serverUrl: manifest.serverUrl,
        phoneNumber: item.phoneNumber,
        platformName,
        isForceRefresh: true,
        isToTriggerContactMatch: false
      });
      if (matched) {
        const realContacts = (contactInfo || []).filter(c => !c.isNewContact);
        // If we still have a target contactId, prefer that contact from the list
        const preferred = item?.contactId ? realContacts.find(c => c.id == item.contactId) : null;
        const chosen = preferred || realContacts[0];
        if (chosen) {
          await contactCore.openContactPage({ manifest, platformName, contactId: chosen.id, contactType: chosen.type });
        } else {
          await contactCore.openContactPage({ manifest, platformName, phoneNumber: item.phoneNumber, multiContactMatchBehavior: 'disabled' });
        }
      } else {
        await contactCore.openContactPage({ manifest, platformName, phoneNumber: item.phoneNumber, multiContactMatchBehavior: 'disabled' });
      }
    }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;