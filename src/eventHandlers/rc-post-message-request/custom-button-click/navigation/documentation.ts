import { trackPage } from '../../../../lib/analytics';
import { showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  if (platform?.documentationUrl) {
    window.open(platform.documentationUrl);
    trackPage('/documentation');
  }
  else {
    showNotification({ level: 'warning', message: 'Documentation URL is not set', ttl: 3000 });
  }
}

export default {
  onEvent,
};
