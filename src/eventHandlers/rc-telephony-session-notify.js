import { addPendingRecordingSessionId } from '../lib/logUtil';

async function onEvent({ data, popupContext }) {
  const hasRecording = data.telephonySession.parties.some(p => !!p.recordings);
  if (hasRecording) {
    await chrome.storage.local.set({
      ['rec-link-' + data.telephonySession.sessionId]: {
        link: "(pending...)",
        expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days
      }
    });
    await addPendingRecordingSessionId({ sessionId: data.telephonySession.sessionId });
  }
  const transferParty = data.telephonySession.parties.find(p => p.status.reason === 'AttendedTransfer' && p.status.code === 'Gone');
  if (transferParty) {
    // eslint-disable-next-line no-param-reassign
    popupContext.transferOnHold = transferParty.status.peerId.telephonySessionId;  }
}

exports.onEvent = onEvent;