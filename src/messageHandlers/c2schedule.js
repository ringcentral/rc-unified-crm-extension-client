import contactCore from '../core/contact';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import { createSchedulePage } from '../components/schedulePage';
import axios from 'axios';
import calldownPage from '../components/calldownPage';
import { cacheCalldownContact } from '../lib/util';

async function onMessage({ request, sendResponse }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platformName = platformInfo.platformName;
    // resolve contacts for the number and show dropdown
    const phoneNumber = request.phoneNumber;
    const res = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName, isForceRefresh: true, isToTriggerContactMatch: true });
    const contacts = (res?.contactInfo || []).filter(c => !c.isNewContact);
    const contactOptions = contacts.map(c => ({ const: c.id, title: c.name }));
    const newContactOption = { const: 'newContact', title: 'Create new contact' };
    const listOneOf = [...contactOptions, newContactOption];
    const isDefaultNew = contacts.length === 0;
    const preselect = isDefaultNew ? 'newContact' : (contactOptions[0]?.const ?? '');
    const schedulePage = createSchedulePage({
        phoneNumber,
        listOneOf,
        isDefaultNew,
        preselect,
        contactTypes: manifest.platforms[platformName]?.contactTypes || []
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: schedulePage }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-navigate-to', path: `/customized/${schedulePage.id}` }, '*');
    const onSchedulePageMessage = async (e) => {
        const data = e.data;
        if (!data) return;
        if (data.type === 'rc-post-message-request' && data.path === '/custom-button-click' && data.body?.page?.id === 'c2dSchedulePage') {
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-post-message-response', responseId: data.requestId, response: { data: 'ok' } }, '*');
            try {
                const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                const rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
                const rcAccountId = rcUserInfo?.rcAccountId ?? '';
                const { phone, note, callbackDateTime } = data.body?.formData || {};
                if (!callbackDateTime) return;
                await axios.post(`${manifest.serverUrl}/calldown?jwtToken=${rcUnifiedCrmExtJwt}${rcAccountId ? `&rcAccountId=${rcAccountId}` : ''}`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: data.body?.formData?.contact, note });

                // Cache contact information for c2schedule flow
                try {
                    const selectedContactId = data.body?.formData?.contact;
                    if (selectedContactId && selectedContactId !== 'newContact') {
                        // Find the contact from the original contacts array that was resolved
                        const selectedContact = contacts.find(c => c.id === selectedContactId);
                        if (selectedContact) {
                            await cacheCalldownContact({
                                contactId: selectedContactId,
                                contactName: selectedContact.name,
                                phoneNumber: phone,
                                contactType: selectedContact.type || 'Contact'
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Failed to cache c2schedule contact info:', e);
                }

                const { userSettings } = await chrome.storage.local.get('userSettings');
                const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, jwtToken: rcUnifiedCrmExtJwt, filterStatus: 'All', userSettings });
                document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: calldownPageRender }, '*');
                document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-navigate-to', path: 'goBack' }, '*');
                window.removeEventListener('message', onSchedulePageMessage);
            }
            catch (err) { console.log(err); }
        }
    };
    window.addEventListener('message', onSchedulePageMessage);
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;