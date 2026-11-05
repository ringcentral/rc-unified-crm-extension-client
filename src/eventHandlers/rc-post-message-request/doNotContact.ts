import doNotContactLib from '../../lib/doNotContact';
import userCore from '../../core/user';
import { responseMessage } from '../../lib/util';
import { t } from '../../i18n';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

const ALLOW = { data: { result: false } };

function getRequestedNumbers(body: UnknownRecord | undefined): string[] {
  if (body?.actionType === 'call') {
    return body.phoneNumber ? [body.phoneNumber] : [];
  }
  if (body?.actionType === 'sms' && Array.isArray(body.recipients)) {
    return body.recipients.map((recipient: UnknownRecord) => recipient?.phoneNumber).filter(Boolean);
  }
  return [];
}

function buildResponse(status: string, numbers: string[]) {
  const single = numbers.length === 1;
  if (status === 'restrict') {
    return {
      data: {
        result: true,
        mode: 'restrict',
        message: single ? t('doNotContact.restrictMessage') : t('doNotContact.restrictMessageMultiple', { numbers: numbers.join(', ') }),
      },
    };
  }
  return {
    data: {
      result: true,
      message: single ? t('doNotContact.warnMessage') : t('doNotContact.warnMessageMultiple', { numbers: numbers.join(', ') }),
    },
  };
}

// The widget asks before every call or text. Any failure must let the action through.
export async function onEvent({ data }: EventOptions): Promise<void> {
  let response: UnknownRecord = ALLOW;
  try {
    const numbers = getRequestedNumbers(data.body);
    if (numbers.length > 0) {
      const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as { userSettings: UnknownRecord };
      const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' }) as { selectedRegion: string };
      const { restrict, warn } = userCore.getDoNotContactNumbers(userSettings);
      if (restrict.length > 0 || warn.length > 0) {
        const matcher = doNotContactLib.buildMatcher({ restrict, warn, region: selectedRegion });
        const result = doNotContactLib.checkNumbers({ numbers, matcher, region: selectedRegion });
        if (result.status === 'restrict') {
          response = buildResponse('restrict', result.restrictedNumbers);
        }
        else if (result.status === 'warn') {
          response = buildResponse('warn', result.warnedNumbers);
        }
      }
    }
  }
  catch (error) {
    console.error('[doNotContact] Check failed, allowing the action', error);
    response = ALLOW;
  }
  responseMessage(data.requestId, response);
}

export default {
  onEvent,
};
