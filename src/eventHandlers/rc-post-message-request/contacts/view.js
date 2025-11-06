import contactCore from '../../../core/contact';
import { showNotification, responseMessage } from '../../../lib/util';
import userCore from '../../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const { hasOngoingCall } = await chrome.storage.local.get({ hasOngoingCall: false });
    if (hasOngoingCall) {
      await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactType: data.body.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
    }
    else {
      await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactId: data.body.id, contactType: data.body.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;