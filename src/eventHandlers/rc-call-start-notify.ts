import { trackAnsweredCall } from '../lib/analytics';

type EventOptions = {
  data: {
    call?: {
      direction?: string;
    };
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  // get call when a incoming call is accepted or a outbound call is connected
  if (data.call?.direction === 'Inbound') {
    trackAnsweredCall();
  }
}

export default {
  onEvent,
};
