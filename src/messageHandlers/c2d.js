async function onMessage({ request, sendResponse }) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-new-call',
      phoneNumber: request.phoneNumber,
      toCall: true,
    }, '*');
    sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;