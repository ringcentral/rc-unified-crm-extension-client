import { trackConnectedCall } from '../lib/analytics';

async function onEvent({ data }) {
    // get call on active call updated event
    if (data.call.telephonyStatus === 'CallConnected') {
      trackConnectedCall();
    }
}

exports.onEvent = onEvent;