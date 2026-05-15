import axios from 'axios';
import { showNotification, getRcInfo } from '../lib/util';

async function upsertDisposition({ serverUrl, logType, sessionId, dispositions }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} });
    const rcInfo = await getRcInfo();
    const extensionNumber = rcInfo?.value?.cachedData?.extensionInfo?.extensionNumber ?? '';
    if (rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const patchBody = {
                    sessionId,
                    extensionNumber,
                    dispositions,
                    additionalSubmission: rcAdditionalSubmission
                }
                const callLogRes = await axios.put(`${serverUrl}/callDisposition?jwtToken=${rcUnifiedCrmExtJwt}`, patchBody);
                if (callLogRes.data.returnMessage) {
                    showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'success', message: callLogRes.data.returnMessage?.message ?? 'Call disposition updated', ttl: callLogRes.data.returnMessage?.ttl ?? 3000, details: callLogRes.data.returnMessage?.details });
                }
                break;
        }
    }
}

exports.upsertDisposition = upsertDisposition;