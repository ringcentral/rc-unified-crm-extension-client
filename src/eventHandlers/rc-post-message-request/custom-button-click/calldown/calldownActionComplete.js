import axios from 'axios';
import calldownPage from '../../../../components/calldownPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const btn = data.body.button || {};
    const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
    await axios.patch(`${manifest.serverUrl}/calldown/${rowId}`, { status: "completed", completedAt: new Date().toISOString() });
    const refreshed = await calldownPage.getCalldownPageWithRecords({
        manifest,
        searchWithFilters: data.body?.button?.formData?.searchWithFilters,
        filterStatus: data.body?.button?.formData?.searchWithFilters?.filter || 'All',
        userSettings
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: refreshed }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;
