import axios from 'axios';
import baseManifest from '../../../manifest.json';
import { getRcInfo } from '../../../lib/util';
import { getProcessorConfigurePageRender } from '../../../components/processorConfigurePage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const selectedProcessorId = listButtonItemId.split('=')[0];
    const selectedProcessorType = listButtonItemId.split('=')[1];
    const selectedProcessor = data.body.button.formData.processorList.find(processor => processor.id === selectedProcessorId);
    const rcInfo = await getRcInfo();
    let processorManifestResponse;
    switch (selectedProcessorType) {
        case 'public':
            processorManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedProcessorId}/manifest?type=processor`);
            break;
        case 'shared':
            processorManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedProcessorId}/manifest?access=internal&type=processor&accountId=${selectedProcessor.accountId}`);
            break;
        case 'private':
            processorManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedProcessorId}/manifest?access=internal&type=processor&accountId=${rcInfo.value.cachedData.accountInfo.id}`);
            break;
    }
    const processorConfigurePageRender = getProcessorConfigurePageRender({ processor: processorManifestResponse.data?.platforms?.[selectedProcessor.name] });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: processorConfigurePageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${processorConfigurePageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;