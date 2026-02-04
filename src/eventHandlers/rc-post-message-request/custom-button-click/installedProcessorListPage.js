import { getProcessorList } from '../../../service/manifestService';
import { getInstalledProcessorListPageRender } from '../../../components/installedProcessorListPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const processorList = await getProcessorList();
    const processorListToRender = [];
    for (const settingsKey in userSettings) {
        if (settingsKey.startsWith('processor_')) {
            const targetProcessor = processorList.find(processor => processor.id === settingsKey.split('processor_')[1]);
            processorListToRender.push(targetProcessor);
        }
    }
    const installedProcessorListPageRender = getInstalledProcessorListPageRender({ viewType: 'installed', processorList: processorListToRender });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: installedProcessorListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${installedProcessorListPageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;