import logCore from '../../../core/log';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
    await logCore.cacheCallNote({ sessionId: data.body.button.formData.sessionId, note: data.body.button.formData.note });
}

exports.onEvent = onEvent;