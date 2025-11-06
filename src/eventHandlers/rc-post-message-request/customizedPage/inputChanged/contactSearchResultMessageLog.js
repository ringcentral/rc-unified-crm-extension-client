import logPage from '../../../../components/logPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (data.body.keys.some(k => k === "contactInfo")) {
        let selectedContact = data.body.page.formData.contactInfo.find(c => c.id === data.body.formData.contactList);
        // Ensure isNewContact is not set for real contacts
        selectedContact = { ...selectedContact };
        delete selectedContact.isNewContact;
        const { cacheLogPageData } = await chrome.storage.local.get("cacheLogPageData");
        const contactData = cacheLogPageData.contactInfo;
        if (contactData.length > 0) {
            const cachedSearchContactKey = `rc-crm-search-contact-${data.body.formData?.contactPhoneNumber}`;
            const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
            let contactArr = storageObj[cachedSearchContactKey] || [];
            if (!contactArr.some(c => c.id === selectedContact.id)) {
                contactArr.push(selectedContact);
            }
            await chrome.storage.local.set({ [cachedSearchContactKey]: contactArr });
        }
        if (!contactData.some(c => c.id === selectedContact.id)) {
            contactData.push(selectedContact);
        }
        const initialLogPage = logPage.getLogPageRender({ ...cacheLogPageData, contactInfo: contactData.map(c => ({ ...c, isNewContact: undefined })) });
        const cachedLogPage = logPage.getUpdatedLogPageRender({
            manifest,
            platformName,
            logType: 'Call',
            updateData: {
                page: initialLogPage,
                formData: {
                    ...initialLogPage.formData,
                    contact: selectedContact.id,
                    contactType: selectedContact.type,
                    contactName: selectedContact.name,
                    contactInfo: contactData.map(c => ({ ...c, isNewContact: undefined })),
                    returnToHistoryPage: true
                },
                keys: ['contact']
            }
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-trigger-contact-match',
            phoneNumbers: [data.body.formData?.contactPhoneNumber],
        }, '*');
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-update-messages-log-page',
            page: cachedLogPage
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/history`
        }, '*');
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/log/messages/${cacheLogPageData.id}`, // page id
        }, '*');
    }
}

exports.onEvent = onEvent;