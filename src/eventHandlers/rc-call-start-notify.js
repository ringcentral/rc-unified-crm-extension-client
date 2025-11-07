import { trackAnsweredCall } from '../lib/analytics';

async function onEvent({ data }) {
    // get call when a incoming call is accepted or a outbound call is connected
    if (data.call.direction === 'Inbound') {
      trackAnsweredCall();
    }
}

exports.onEvent = onEvent;