import axios from 'axios';

type UnknownRecord = Record<string, any>;

type GetContactWidgetsOptions = {
  serverUrl: string;
  phoneNumber: string;
  contacts: UnknownRecord[];
};

type GetContactWidgetsResult = {
  successful: boolean;
  returnMessage?: { message?: string; messageType?: string } | null;
  widgets: { contactId: string; widget: UnknownRecord }[];
};

/** Asks the connector (through the server) for the widget of each matched contact. Not cached. */
export async function getContactWidgets({ serverUrl, phoneNumber, contacts }: GetContactWidgetsOptions): Promise<GetContactWidgetsResult> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as {
    rcUnifiedCrmExtJwt?: string;
  };
  const response = await axios.post(
    `${serverUrl}/contact/widget`,
    { phoneNumber, contacts },
    rcUnifiedCrmExtJwt ? { headers: { Authorization: `Bearer ${rcUnifiedCrmExtJwt}` } } : undefined,
  );
  return {
    successful: !!response.data?.successful,
    returnMessage: response.data?.returnMessage ?? null,
    widgets: response.data?.widgets ?? [],
  };
}

export default {
  getContactWidgets,
};
