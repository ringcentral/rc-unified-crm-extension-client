// Captures the SMS sender-number settings emitted by the RingCentral Embeddable
// widget (requires enableSmsSettingEvent on the adapter). We persist the list of
// available sender numbers and, once, the user's default (direct) sender number
// so click-to-SMS can optionally send from a shared/company number instead.

type SenderNumberEntry = string | { phoneNumber?: string } | null | undefined;

type SmsSettingsNotifyData = {
  senderNumber?: string;
  senderNumbers?: SenderNumberEntry[];
};

type EventOptions = {
  data?: SmsSettingsNotifyData;
};

type SmsStorageUpdate = {
  smsSenderNumbers: string[];
  smsDefaultSenderNumber?: string;
};

export function normalizeSenderNumbers(senderNumbers: unknown): string[] {
  if (!Array.isArray(senderNumbers)) {
    return [];
  }

  return senderNumbers
    .map((entry: SenderNumberEntry) => (typeof entry === 'string' ? entry : entry?.phoneNumber))
    .filter((phoneNumber): phoneNumber is string => Boolean(phoneNumber));
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  const update: SmsStorageUpdate = {
    smsSenderNumbers: normalizeSenderNumbers(data?.senderNumbers),
  };

  if (data?.senderNumber) {
    // Capture the user's direct/default sender number only once. Overriding the
    // sender for click-to-SMS changes the "current" sender in later notify events,
    // so persisting it once keeps the direct-vs-shared comparison stable.
    const { smsDefaultSenderNumber } = await chrome.storage.local.get({ smsDefaultSenderNumber: null });
    if (!smsDefaultSenderNumber) {
      update.smsDefaultSenderNumber = data.senderNumber;
    }
  }

  await chrome.storage.local.set(update);
}

export default {
  onEvent,
  normalizeSenderNumbers,
};
