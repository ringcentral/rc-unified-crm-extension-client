import { trackEditSettings } from '../lib/analytics';

type EventOptions = {
  data: {
    autoLog?: unknown;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  trackEditSettings({ changedItem: 'auto-message-log', status: data.autoLog });
}

export default {
  onEvent,
};
