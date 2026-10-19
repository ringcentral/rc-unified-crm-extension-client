import { trackPlacedCall } from '../lib/analytics';

type EventOptions = {
  data: unknown;
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  void data;
  trackPlacedCall();
}

export default {
  onEvent,
};
