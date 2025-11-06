async function onEvent({data}){
    chrome.runtime.sendMessage({
      type: 'sideWidgetOpen',
      opened: data.open
    });
}

exports.onEvent = onEvent;