type EventOptions = {
  data: {
    oAuthUri?: string;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  chrome.runtime.sendMessage({
    type: 'openRCOAuthWindow',
    oAuthUri: data.oAuthUri,
  });
}

export default {
  onEvent,
};
