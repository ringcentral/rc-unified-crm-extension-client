import { trackRingSensePage } from '../lib/analytics';

async function onMessage({ request, sendResponse }) {
    trackRingSensePage();
    sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;
