import { trackSentSMS, trackCreateMeeting, trackCallEnd } from '../lib/analytics';

async function onEvent({ data }) {
    switch (data.event) {
      case 'SMS: SMS sent successfully':
        trackSentSMS();
        break;
      case 'Meeting Scheduled':
        trackCreateMeeting();
        break;
      case 'WebRTC Call Ended':
        const { callWith, callingMode } = await chrome.storage.local.get({ callWith: null, callingMode: null });
        await chrome.storage.local.set({hasOngoingCall: false});
        trackCallEnd({
          direction: data.properties.direction,
          durationInSeconds: data.properties.duration,
          result: data.properties.result,
          callWith,
          callingMode
        });
        break;
    }
}

exports.onEvent = onEvent;