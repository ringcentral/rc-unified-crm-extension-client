import axios from 'axios';
import calldownPage from '../../../components/calldownPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const btn = data.body.button || {};
    const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    await axios.patch(`${manifest.serverUrl}/calldown/${rowId}?jwtToken=${rcUnifiedCrmExtJwt}${rcAccountId ? `&rcAccountId=${rcAccountId}` : ''}`, { status:"called",lastCallAt: new Date().toISOString() });
    const refreshed = await calldownPage.getCalldownPageWithRecords({
        manifest,
        jwtToken: rcUnifiedCrmExtJwt,
        searchWithFilters: data.body?.button?.formData?.searchWithFilters,
        filterStatus: data.body?.button?.formData?.searchWithFilters?.filter || 'All',
        userSettings
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: refreshed }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;