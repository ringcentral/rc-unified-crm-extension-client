type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformName;
  void platform;
  const hostname = platformInfo.hostname;
  window.open(`https://${hostname}/Users/UserSettings`);
}

export default {
  onEvent,
};
