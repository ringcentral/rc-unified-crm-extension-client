import contactCore from '../core/contact';
import { getPlatformInfo } from '../service/platformService';

// Choose the first available sender number that is not the user's direct/default
// number. Returns null when only the direct number is available.
function pickSharedSenderNumber({ senderNumbers, directNumber }) {
    if (!Array.isArray(senderNumbers)) {
        return null;
    }
    const shared = senderNumbers.find((number) => !!number && number !== directNumber);
    return shared ?? null;
}

async function onMessage({ request, sendResponse }) {
    const platformInfo = await getPlatformInfo();
    const platformName = platformInfo?.platformName ?? '';
    const cachedContacts = contactCore.getLocalCachedContact({ phoneNumber: request.phoneNumber, platformName });
    const recipient = cachedContacts?.length > 0 ? { name: cachedContacts[0].name } : {};
    const widgetFrame = document.querySelector("#rc-widget-adapter-frame");

    // When the user has opted in, send click-to-SMS from a shared/company number
    // instead of their direct number. This only affects new conversations; existing
    // conversations keep their previous sender per the RingCentral widget behavior.
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    if (userSettings?.clickToSMSFromSharedNumber?.value === true) {
        const { smsSenderNumbers, smsDefaultSenderNumber } = await chrome.storage.local.get({
            smsSenderNumbers: [],
            smsDefaultSenderNumber: null,
        });
        const sharedSenderNumber = pickSharedSenderNumber({
            senderNumbers: smsSenderNumbers,
            directNumber: smsDefaultSenderNumber,
        });
        if (sharedSenderNumber) {
            widgetFrame.contentWindow.postMessage({
                type: 'rc-sms-settings-update',
                senderNumber: sharedSenderNumber,
            }, '*');
        }
    }

    widgetFrame.contentWindow.postMessage({
      type: 'rc-adapter-new-sms',
      phoneNumber: request.phoneNumber,
      conversation: true, // will go to conversation page if conversation existed
      recipient
    }, '*');
    sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;
exports.pickSharedSenderNumber = pickSharedSenderNumber;
