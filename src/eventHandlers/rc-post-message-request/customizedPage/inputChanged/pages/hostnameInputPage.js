import hostnameInputPage from '../../../../../components/hostnameInputPage';
import authCore from '../../../../../core/auth';
import { getRcInfo } from '../../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    let isUrlValid = true;
    if (manifest.platforms[data.body.formData.platformId]?.environment?.url) {
        const urlIdentifierRegex = new RegExp(manifest.platforms[data.body.formData.platformId].environment.url.replace(/\*/g, '.*'));
        isUrlValid = urlIdentifierRegex.test(data.body.formData.url);
    }
    const rcInfo = await getRcInfo();
    const selectedPlatform = manifest.platforms[data.body.formData.platformId];
    const sharedAuthState = selectedPlatform?.auth?.type === 'apiKey'
        ? await authCore.getSharedAuthState({
            serverUrl: manifest.serverUrl,
            platformName: data.body.formData.platformId,
            connectorId: data.body.formData.connectorId ?? '',
            isPrivate: !!data.body.formData.isPrivate,
            rcInfo
        })
        : null;
    const hostnameInputPageRender = hostnameInputPage.getHostnameInputPageRender(
        {
            platform: selectedPlatform,
            inputUrl: data.body.formData.url,
            selection: data.body.formData.selection,
            isUrlValid,
            submitText: sharedAuthState?.allRequiredFieldsSatisfied ? 'Connect' : undefined,
            connectorId: data.body.formData.connectorId ?? '',
            isPrivate: !!data.body.formData.isPrivate
        });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: hostnameInputPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${hostnameInputPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;
