import { trackEditSettings } from '../lib/analytics';
import logService from '../service/logService';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';

async function onEvent({ data }) {
    const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platformName = platformInfo?.platformName ?? '';;
    const platform = manifest?.platforms[platformName];
    trackEditSettings({ changedItem: 'auto-call-log', status: data.autoLog });
    if (!!data.autoLog && !!crmAuthed) {
      await chrome.storage.local.set({ retroAutoCallLogMaxAttempt: 10 });
      const retroAutoCallLogIntervalId = setInterval(
        function () {
          logService.retroAutoCallLog({
            manifest,
            platformName,
            platform
          })
        }, 60000);
      await chrome.storage.local.set({ retroAutoCallLogIntervalId });
    }
}

exports.onEvent = onEvent;