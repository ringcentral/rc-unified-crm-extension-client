import { getProcessorMarketListPageRender } from '../../../components/processorMarketListPage';
import { getProcessorList } from '../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform, viewType }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const processorList = await getProcessorList();
    const processorListToRender = [];
    for (const processor of processorList) {
        if (Object.keys(userSettings)?.includes(`processor_${processor.id}`)) {
            continue;
        }
        processorListToRender.push(processor);
    }
    const processorMarketListPageRender = getProcessorMarketListPageRender({ viewType, processorList: processorListToRender });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: processorMarketListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${processorMarketListPageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;