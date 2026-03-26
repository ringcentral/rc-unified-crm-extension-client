import { trackPage } from '../../../../lib/analytics';
import { showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (platform?.documentationUrl) {
        window.open(platform.documentationUrl);
        trackPage('/documentation');
    }
    else {
        showNotification({ level: 'warning', message: 'Documentation URL is not set', ttl: 3000 });
    }
}

exports.onEvent = onEvent;