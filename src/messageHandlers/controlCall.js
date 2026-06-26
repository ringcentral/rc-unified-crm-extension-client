async function onMessage({ request, sendResponse }) {
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-control-call',
    callAction: request.callAction,
    callId: request.callId,
    options: request.options,
  }, '*');
  sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;
