import authCore from '../core/auth';

async function onEvent({data}){
    // get call on active call updated event
    if (data.connectionStatus === 'connectionStatus-connected') { // connectionStatus-connected, connectionStatus-disconnected
      await authCore.checkAuth();

      RCAdapter.showFeedback({
        onFeedback: function () {
          window.postMessage({
            path: '/custom-button-click',
            type: 'rc-post-message-request',
            body: { button: { id: 'openSupportPage' } }
          });
        },
      });
    }
}

exports.onEvent = onEvent;