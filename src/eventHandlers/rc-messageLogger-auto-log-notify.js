import { trackEditSettings } from '../lib/analytics';

async function onEvent({ data }) {
    trackEditSettings({ changedItem: 'auto-message-log', status: data.autoLog });
}

exports.onEvent = onEvent;