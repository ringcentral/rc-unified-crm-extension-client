import contactCore from '../core/contact';
import { getPlatformInfo } from '../service/platformService';

async function onMessage({ request, sendResponse }) {
    const platformInfo = await getPlatformInfo();
    const platformName = platformInfo.platformName;
    const cachedContacts = contactCore.getLocalCachedContact({ phoneNumber: request.phoneNumber, platformName });
    const recipient = cachedContacts?.length > 0 ? { name: cachedContacts[0].name } : {};
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-new-sms',
      phoneNumber: request.phoneNumber,
      conversation: true, // will go to conversation page if conversation existed
      recipient
    }, '*');
    sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;