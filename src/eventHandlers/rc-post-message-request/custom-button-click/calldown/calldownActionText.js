async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    const btn = data.body.button || {};
    const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] });
    const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
    const item = (calldownListCache || []).find(i => i.id === rowId || String(i.contactId) === String(rowId)) || { phoneNumber: btn?.additionalInfo?.phoneNumber };

    if (item?.phoneNumber) {
      document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-new-sms',
        phoneNumber: item.phoneNumber,
        conversation: true
      }, '*');
    }
}

exports.onEvent = onEvent;