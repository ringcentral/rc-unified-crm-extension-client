import { createDebounceHandler, responseMessage } from '../../../../lib/util';
import contactCore from '../../../../core/contact';

const debounceContactSearch = createDebounceHandler('contactSearch');

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (data.body.keys.some(k => k === 'search')) {
        debounceContactSearch(data.requestId, async (request) => {
            const searchWord = data.body.formData.search;
            contactCore.refreshContactPromptPage({ contactInfo: data.body.page.formData.contactInfo, searchWord });
        });
    }
    else if (data.body.keys.some(k => k === 'contactList')) {
        const contactToOpen = data.body.formData.contactInfo.find(c => c.id === data.body.formData.contactList);
        contactCore.openContactPage({ manifest, platformName, contactType: contactToOpen.type, contactId: contactToOpen.id });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: 'goBack',
        }, '*');
        // bring back inbound call modal if in Ringing state if exist
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-control-call',
            callAction: 'toggleRingingDialog',
        }, '*');
        responseMessage(data.requestId, { data: 'ok' });
    }
}

exports.onEvent = onEvent;