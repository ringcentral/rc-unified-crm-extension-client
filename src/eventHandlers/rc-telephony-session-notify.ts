import { addPendingRecordingSessionId } from '../lib/logUtil';
import { openContactPage } from '../core/contact';
import userCore from '../core/user';
import { getManifest } from '../service/manifestService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  popupContext: UnknownRecord;
};

export async function onEvent({ data, popupContext }: EventOptions): Promise<void> {
  const hasRecording = data.telephonySession.parties.some((p: UnknownRecord) => !!p.recordings);
  if (hasRecording) {
    await chrome.storage.local.set({
      ['rec-link-' + data.telephonySession.sessionId]: {
        link: '(pending...)',
        expiry: new Date().getTime() + 60000 * 60 * 24 * 30, // 30 days
      },
    });
    await addPendingRecordingSessionId({ sessionId: data.telephonySession.sessionId });
  }
  const parties = data.telephonySession.parties;
  const transferParty = parties.find((p: UnknownRecord) => p.status.reason === 'AttendedTransfer' && p.status.code === 'Gone' && p.direction === 'Outbound');
  if (transferParty) {
    // eslint-disable-next-line no-param-reassign
    popupContext.transferOnHold = transferParty.status.peerId.telephonySessionId;
  }

  // check for warm-transfer case
  const answeredParty = parties.find((p: UnknownRecord) => p.status.code === 'Answered' && p.status.reason === 'AttendedTransfer');
  if (answeredParty) {
    const { 'platform-info': platformInfo } = await chrome.storage.local.get('platform-info') as { 'platform-info': UnknownRecord };
    const manifest = await getManifest();
    const platformName = platformInfo.platformName;
    const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
    const phoneNumber = answeredParty.direction === 'Inbound' ? answeredParty.from.phoneNumber : answeredParty.to.phoneNumber;
    await openContactPage({ manifest, platformName, phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
  }
}

export default {
  onEvent,
};
