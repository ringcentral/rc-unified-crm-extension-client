import axios from 'axios';
import calldownPage from '../../../components/calldownPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    const btn = data.body.button || {};
    const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] });
    const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
    const item = (calldownListCache || []).find(i => i.id === rowId) || { phoneNumber: btn?.additionalInfo?.phoneNumber };
    if (item?.phoneNumber) {
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-new-call',
            phoneNumber: item.phoneNumber,
            toCall: true
        }, '*');
        // Mark this calldown item as called
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
        const rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
        const rcAccountId = rcUserInfo?.rcAccountId ?? '';
        await axios.patch(`${manifest.serverUrl}/calldown/${rowId}?jwtToken=${rcUnifiedCrmExtJwt}${rcAccountId ? `&rcAccountId=${rcAccountId}` : ''}`,
            {status:"called", lastCallAt: new Date().toISOString() });
        // Refresh Call-down list and pill (preserve current filter)
        // Get current filter from form data to preserve user's view
        const currentFilter = data.body?.page?.formData?.searchWithFilters?.filter ||
            data.body?.formData?.searchWithFilters?.filter ||
            data.body?.formData?.filterStatus || 'All';
        const currentSearch = data.body?.page?.formData?.searchWithFilters?.search ||
            data.body?.formData?.searchWithFilters?.search || '';

        const { userSettings } = await chrome.storage.local.get('userSettings');
        const refreshed = await calldownPage.getCalldownPageWithRecords({
            manifest,
            jwtToken: rcUnifiedCrmExtJwt,
            filterStatus: currentFilter,
            searchWithFilters: {
                search: currentSearch,
                filter: currentFilter
            },
            userSettings
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: refreshed
        }, '*');
    }
}

exports.onEvent = onEvent;