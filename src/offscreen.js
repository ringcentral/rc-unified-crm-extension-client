function responseMessage(request, response) {
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-post-message-response',
    responseId: request.requestId,
    response,
  }, '*');
}

window.addEventListener('message', (e) => {
  const data = e.data;
  if (data) {
    switch (data.type) {
      case 'rc-call-ring-notify':
        chrome.runtime.sendMessage({
          type: 'openPopupWindow',
        });
        break;
      case 'rc-call-end-notify':
        // get call on call end event
        break;
      case 'rc-call-start-notify':
        // get call on start a outbound call event
        break;
      default:
        break;
    }
  }
});

const iframeUrl = `./embeddable/app.html` + window.location.search;
const iframe = document.querySelector('iframe');
iframe.src = iframeUrl;

