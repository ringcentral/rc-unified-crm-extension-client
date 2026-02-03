import { getProcessorListPageRender } from '../../../components/processorListPage';
import { getProcessorList } from '../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform, viewType }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const processorList = await getProcessorList();
    const processorListToRender = [];
    switch (viewType) {
        case 'new':
            for (const processor of processorList) {
                if (Object.keys(userSettings)?.includes(`processor_${processor.id}`)) {
                    continue;
                }
                processorListToRender.push(processor);
            }
            break;
        case 'installed':
            for (const settingsKey in userSettings) {
                if (settingsKey.startsWith('processor_')) {
                    const targetProcessor = processorList.find(processor => processor.id === settingsKey.split('processor_')[1]);
                    processorListToRender.push(targetProcessor);
                }
            }
            break;
    }
    const processorListPageRender = getProcessorListPageRender({ viewType, processorList: processorListToRender });
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