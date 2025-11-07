import { trackPlacedCall } from '../lib/analytics';

async function onEvent({ data }) {
    trackPlacedCall();
}

exports.onEvent = onEvent;