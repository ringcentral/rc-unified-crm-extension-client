import authCore from '../core/auth';

type EventOptions = {
  data: {
    connectionStatus?: string;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  // get call on active call updated event
  if (data.connectionStatus === 'connectionStatus-connected') { // connectionStatus-connected, connectionStatus-disconnected
    await authCore.checkAuth();

    RCAdapter.showFeedback!({
      onFeedback: function () {
        (window.postMessage as any)({
          path: '/custom-button-click',
          type: 'rc-post-message-request',
          body: { button: { id: 'openSupportPage' } },
        });
      },
    });
  }
}

export default {
  onEvent,
};
