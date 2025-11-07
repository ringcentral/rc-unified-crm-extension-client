import { addPendingRecordingSessionId } from '../lib/logUtil';

async function onEvent({data}){
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
}

exports.onEvent = onEvent;