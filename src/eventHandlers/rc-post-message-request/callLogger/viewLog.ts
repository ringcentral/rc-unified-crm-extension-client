import logCore from '../../../core/log';
import contactCore from '../../../core/contact';
import userCore from '../../../core/user';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
  existingCalls: UnknownRecord[];
  contactPhoneNumber: string;
  userSettings: UnknownRecord;
};

export async function onEvent({ data, manifest, platformInfo, platformName, platform, existingCalls, contactPhoneNumber, userSettings }: EventOptions): Promise<void> {
  void platform;
  const matchedEntity = data.body.call.direction === 'Inbound' ? data.body.fromEntity : data.body.toEntity;
  if (manifest.platforms[platformName].canOpenLogPage) {
    logCore.openLog({ manifest, platformName, hostname: platformInfo.hostname, logId: existingCalls.find(l => l.sessionId == data.body.call.sessionId)?.logId, contactType: matchedEntity.contactType, contactId: matchedEntity.id, userSettings });
  }
  else {
    await contactCore.openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: matchedEntity.id, contactType: matchedEntity.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
  }
}

export default {
  onEvent,
};
