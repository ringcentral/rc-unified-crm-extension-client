import axios from 'axios';
import { isObjectEmpty, showNotification } from '../lib/util';

async function upsertDisposition({ serverUrl, logType, sessionId, dispositions, rcAdditionalSubmission }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const patchBody = {
                    sessionId,
                    dispositions,
                    additionalSubmission: rcAdditionalSubmission
                }
                const callLogRes = await axios.put(`${serverUrl}/callDisposition?jwtToken=${rcUnifiedCrmExtJwt}`, patchBody);
                if(callLogRes.data.returnMessage)
                {
                    showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'success', message: callLogRes.data.returnMessage?.message ?? 'Call disposition updated', ttl: callLogRes.data.returnMessage?.ttl ?? 3000, details: callLogRes.data.returnMessage?.details });
                }
                break;
        }
    }
}

exports.upsertDisposition = upsertDisposition;