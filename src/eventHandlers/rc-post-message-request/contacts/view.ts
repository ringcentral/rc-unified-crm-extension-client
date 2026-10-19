import contactCore from '../../../core/contact';
import { responseMessage } from '../../../lib/util';
import userCore from '../../../core/user';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
};

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
  const { hasOngoingCall } = await chrome.storage.local.get({ hasOngoingCall: false }) as { hasOngoingCall: boolean };
  if (hasOngoingCall) {
    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactType: data.body.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
  }
  else {
    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactId: data.body.id, contactType: data.body.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  responseMessage(data.requestId, { data: 'ok' });
}

export default {
  onEvent,
};
