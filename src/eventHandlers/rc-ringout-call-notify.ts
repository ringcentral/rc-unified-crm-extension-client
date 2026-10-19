import { trackConnectedCall } from '../lib/analytics';

type EventOptions = {
  data: {
    call?: {
      telephonyStatus?: string;
    };
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  // get call on active call updated event
  if (data.call?.telephonyStatus === 'CallConnected') {
    trackConnectedCall();
  }
}

export default {
  onEvent,
};
