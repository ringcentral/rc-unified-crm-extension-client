type EventOptions = {
  data: {
    open?: boolean;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  chrome.runtime.sendMessage({
    type: 'sideWidgetOpen',
    opened: data.open,
  });
}

export default {
  onEvent,
};
