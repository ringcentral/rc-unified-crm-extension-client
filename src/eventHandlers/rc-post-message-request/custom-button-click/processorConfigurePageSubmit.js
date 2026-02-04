import { refreshUserSettings } from '../../../core/user';
import { getRcInfo, showNotification } from '../../../lib/util';
import { getProcessorList } from '../../../service/manifestService';
import { getProcessorListPageRender } from '../../../components/processorMarketListPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo.value.cachedData.extensionInfo.account.id;
    const form = data.body.button.formData;
    const changedSettings = {
        [`processor_${form.processorId}`]: {
            value: {
                name: form.processor.name,
                version: form.processor.version,
                activated: form.activated,
                isAsync: form.isAsync,
                phase: form.phase,
                access: form.access,
                logType: form.logType,
                rcAccountId,
            }
        }
    }
    const userSettings = await refreshUserSettings({ changedSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack'
    }, '*');
    // const processorList = await getProcessorList();
    // const processorListToRender = [];
    // for (const settingsKey in userSettings) {
    //     if (settingsKey.startsWith('processor_')) {
    //         const targetProcessor = processorList.find(processor => processor.id === settingsKey.split('processor_')[1]);
    //         processorListToRender.push(targetProcessor);
    //     }
    // }
    // const processorListPageRender = getProcessorListPageRender({ viewType: 'installed', processorList: processorListToRender });
    // document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    //     type: 'rc-adapter-register-customized-page',
    //     page: processorListPageRender
    // });
    // document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    //     type: 'rc-adapter-navigate-to',
    //     path: `/customized/${processorListPageRender.id}`
    // }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: `Process is ${form.viewType === 'installed' ? 'updated' : 'installed'}.`, ttl: 3000 });
}

exports.onEvent = onEvent;