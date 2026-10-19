import { trackSentSMS, trackCreateMeeting, trackCallEnd } from '../lib/analytics';

type EventOptions = {
  data: {
    event?: string;
    properties?: {
      direction?: unknown;
      duration?: unknown;
      result?: unknown;
    };
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  switch (data.event) {
    case 'SMS: SMS sent successfully':
      trackSentSMS();
      break;
    case 'Meeting Scheduled':
      trackCreateMeeting();
      break;
    case 'WebRTC Call Ended': {
      const { callWith, callingMode } = await chrome.storage.local.get({ callWith: null, callingMode: null }) as {
        callWith: unknown;
        callingMode: unknown;
      };
      await chrome.storage.local.set({ hasOngoingCall: false });
      trackCallEnd({
        direction: data.properties?.direction,
        durationInSeconds: data.properties?.duration,
        result: data.properties?.result,
        callWith,
        callingMode,
      });
      break;
    }
  }
}

export default {
  onEvent,
};
