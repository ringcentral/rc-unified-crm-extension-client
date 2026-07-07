import { trackEditSettings } from '../lib/analytics';
import logService from '../service/logService';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: {
    autoLog?: unknown;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false }) as { crmAuthed: boolean };
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';
  const platform = manifest?.platforms[platformName];
  trackEditSettings({ changedItem: 'auto-call-log', status: data.autoLog });
  if (!!data.autoLog && !!crmAuthed) {
    await chrome.storage.local.set({ retroAutoCallLogMaxAttempt: 10 });
    const retroAutoCallLogIntervalId = setInterval(
      function () {
        logService.retroAutoCallLog({
          manifest: manifest as any,
          platformName,
          platform,
        });
      }, 60000);
    await chrome.storage.local.set({ retroAutoCallLogIntervalId });
  }
}

export default {
  onEvent,
};
