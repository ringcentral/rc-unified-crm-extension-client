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

const RETRO_AUTO_LOG_INTERVAL_MS = 10 * 60 * 1000;

let retroAutoCallLogIntervalId: ReturnType<typeof setInterval> | undefined;
let retroAutoCallLogInProgress = false;

function stopRetroAutoCallLog(): void {
  if (retroAutoCallLogIntervalId !== undefined) {
    clearInterval(retroAutoCallLogIntervalId);
    retroAutoCallLogIntervalId = undefined;
  }
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false }) as { crmAuthed: boolean };
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';
  const platform = manifest?.platforms[platformName];
  trackEditSettings({ changedItem: 'auto-call-log', status: data.autoLog });
  stopRetroAutoCallLog();
  await chrome.storage.local.remove('retroAutoCallLogIntervalId');
  if (!!data.autoLog && !!crmAuthed) {
    const runRetroAutoCallLog = async (): Promise<void> => {
      if (retroAutoCallLogInProgress) {
        return;
      }
      retroAutoCallLogInProgress = true;
      try {
        await logService.retroAutoCallLog({
          manifest: manifest as any,
          platformName,
          platform,
        });
      }
      finally {
        retroAutoCallLogInProgress = false;
      }
    };
    retroAutoCallLogIntervalId = setInterval(
      () => void runRetroAutoCallLog(),
      RETRO_AUTO_LOG_INTERVAL_MS,
    );
    await chrome.storage.local.set({ retroAutoCallLogIntervalId });
  }
}

export default {
  onEvent,
};
