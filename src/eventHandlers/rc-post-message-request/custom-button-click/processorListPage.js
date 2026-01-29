import { getProcessorListPageRender } from '../../../components/processorListPage';
import { getProcessorList } from '../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const processorList = await getProcessorList();
    const { userSettings } = await chrome.storage.local.get('userSettings');
    for (const processor of processorList) {
        const processorSetting = userSettings?.[`processor_${processor.id}`];
        if (processorSetting) {
            processor.isActivated = processorSetting.value.activated;
        }
    }
    const processorListPageRender = getProcessorListPageRender({ processorList });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: processorListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${processorListPageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;