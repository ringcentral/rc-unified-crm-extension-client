import contactCore from '../core/contact';
import { getPlatformInfo } from '../service/platformService';
import { getManifest } from '../service/manifestService';
import { getSchedulePageRender } from '../components/schedulePage';

async function onEvent({ data }) {
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platformName = platformInfo?.platformName ?? '';
    if (data.ready) {
        // check for Click-To-Dial or Click-To-SMS cached action
        let cachedClickToXRequest = await chrome.runtime.sendMessage(
            {
                type: 'checkForClickToXCache'
            }
        )
        if (cachedClickToXRequest) {
            if (cachedClickToXRequest.type === 'c2d') {
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-new-call',
                    phoneNumber: cachedClickToXRequest.phoneNumber,
                    toCall: true,
                }, '*');
            }
            else if (cachedClickToXRequest.type === 'c2sms') {
                const cachedContacts = contactCore.getLocalCachedContact({ phoneNumber: cachedClickToXRequest.phoneNumber, platformName });
                const recipient = cachedContacts?.length > 0 ? { name: cachedContacts[0].name } : {};
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-new-sms',
                    phoneNumber: cachedClickToXRequest.phoneNumber,
                    conversation: true, // will go to conversation page if conversation existed
                    recipient
                }, '*');
            }
            else if (cachedClickToXRequest.type === 'c2schedule') {
                try {
                    const phoneNumber = cachedClickToXRequest.phoneNumber;
                    const res = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName, isForceRefresh: true, isToTriggerContactMatch: true });
                    const contacts = (res?.contactInfo || []).filter(c => !c.isNewContact);
                    const contactOptions = contacts.map(c => ({ const: c.id, title: c.name }));
                    const newContactOption = { const: 'newContact', title: 'Create new contact' };
                    const listOneOf = [...contactOptions, newContactOption];
                    // Default to Create new contact when there is no match
                    const isDefaultNew = contacts.length === 0;
                    const preselect = isDefaultNew ? 'newContact' : (contactOptions[0]?.const ?? '');
                    const ct = manifest.platforms[platformName]?.contactTypes || [];
                    const schedulePage = getSchedulePageRender({
                        phoneNumber,
                        listOneOf,
                        isDefaultNew,
                        preselect,
                        contactTypes: ct
                    });
                    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: schedulePage }, '*');
                    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-navigate-to', path: `/customized/${schedulePage.id}` }, '*');

                } catch (e) { console.log(e); }
            }
        }
    }
}

exports.onEvent = onEvent;