import axios from 'axios';
import { showNotification, getRcCallLogIdentity } from '../lib/util';

type LogType = 'Call' | string;

interface UpsertDispositionOptions {
  serverUrl: string;
  logType: LogType;
  sessionId: string;
  dispositions: Record<string, unknown>;
  [key: string]: unknown;
}

interface ReturnMessage {
  messageType?: string;
  message?: string;
  ttl?: number;
  details?: unknown;
}

interface CallDispositionResponse {
  returnMessage?: ReturnMessage;
}

export async function upsertDisposition({
  serverUrl,
  logType,
  sessionId,
  dispositions,
}: UpsertDispositionOptions): Promise<void> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as {
    rcUnifiedCrmExtJwt?: string;
  };
  const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} }) as {
    rcAdditionalSubmission: Record<string, unknown>;
  };
  const { extensionNumber, hashedExtensionId } = await getRcCallLogIdentity();
  if (rcUnifiedCrmExtJwt) {
    switch (logType) {
      case 'Call': {
        const patchBody = {
          sessionId,
          dispositions,
          additionalSubmission: rcAdditionalSubmission,
          extensionNumber,
          hashedExtensionId,
        };
        const callLogRes = await axios.put(`${serverUrl}/callDisposition`, patchBody);
        const data = callLogRes.data as CallDispositionResponse;
        if (data.returnMessage) {
          showNotification({
            level: data.returnMessage?.messageType ?? 'success',
            message: data.returnMessage?.message ?? 'Call disposition updated',
            ttl: data.returnMessage?.ttl ?? 3000,
            details: data.returnMessage?.details,
          });
        }
        break;
      }
    }
  }
}

const dispositionCore = {
  upsertDisposition,
};

export default dispositionCore;
