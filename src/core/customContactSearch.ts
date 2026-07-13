import axios from 'axios';
import { showNotification } from '../lib/util';

type UnknownRecord = Record<string, unknown>;

interface CustomContactSearchOptions {
  contactSearchAdapterButton?: string;
  contactPhoneNumber?: unknown;
  appointment?: boolean;
  emailMandatoryInAttendee?: boolean;
  formData?: UnknownRecord;
}

interface CustomContactSearchDataOptions {
  serverUrl: string;
  platform?: unknown;
  contactSearch?: string;
  pageId: string;
  contactPhoneNumber?: unknown;
  appointment?: boolean;
  emailMandatoryInAttendee?: boolean;
  formData?: UnknownRecord & {
    appointmentCreateDraft?: {
      emailMandatoryInAttendee?: boolean;
    };
    appointmentEditDraft?: {
      emailMandatoryInAttendee?: boolean;
    };
  };
}

interface ContactInfo extends UnknownRecord {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  email?: unknown;
}

interface ContactSearchResponse {
  contact: ContactInfo[];
  returnMessage: {
    messageType: string;
    message: string;
    ttl: number;
  };
}

function hasContactEmail(contact: ContactInfo): boolean {
  const directEmail = String(
    contact?.email ??
    '',
  ).trim();
  if (directEmail) return true;
  return false;
}

export function getCustomContactSearch({
  contactSearchAdapterButton = 'contactSearchAdapterButton',
  contactPhoneNumber,
  appointment = false,
  emailMandatoryInAttendee,
  formData = {},
}: CustomContactSearchOptions) {
  void emailMandatoryInAttendee;
  return {
    id: 'searchContact',
    type: 'page',
    schema: {
      type: 'object',
      required: [],
      properties: {
        contactNameToSearch: {
          type: 'string',
          title: 'Contact Search',
        },
        [contactSearchAdapterButton]: {
          type: 'string',
          title: 'Search',
        },
      },
    },
    uiSchema: {
      contactNameToSearch: {
        'ui:placeholder': 'enter contact name to search',
      },
      [contactSearchAdapterButton]: {
        'ui:field': 'button',
        'ui:variant': 'contained', // "text", "outlined", "contained", "plain"
        'ui:fullWidth': true,
      },
      'ui:order': appointment
        ? ['contactNameToSearch', contactSearchAdapterButton]
        : ['contactNameToSearch', contactSearchAdapterButton],
    },
    formData: {
      contactPhoneNumber,
      appointment,
      ...(formData || {}),
    },
  };
}

export async function getCustomContactSearchData({
  serverUrl,
  platform,
  contactSearch,
  pageId,
  contactPhoneNumber,
  appointment = false,
  emailMandatoryInAttendee,
  formData = {},
}: CustomContactSearchDataOptions) {
  void platform;
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as {
    rcUnifiedCrmExtJwt?: string;
  };
  const resolvedEmailMandatoryInAttendee =
    emailMandatoryInAttendee ??
    formData?.appointmentCreateDraft?.emailMandatoryInAttendee ??
    formData?.appointmentEditDraft?.emailMandatoryInAttendee;
  const appointmentEmailFilter = appointment && resolvedEmailMandatoryInAttendee !== false;
  const requestConfig: UnknownRecord = {
    params: {
      name: contactSearch ?? '',
    },
  };
  if (rcUnifiedCrmExtJwt) {
    requestConfig.headers = {
      Authorization: `Bearer ${rcUnifiedCrmExtJwt}`,
    };
  }
  const contactRes = await axios.get(`${serverUrl}/custom/contact/search`, requestConfig);
  const data = contactRes.data as ContactSearchResponse;
  if (data.contact.length === 0) {
    showNotification({
      level: data.returnMessage.messageType,
      message: data.returnMessage.message,
      ttl: data.returnMessage.ttl,
    });
  } else {
    const contactInfo = data.contact;
    const warningFieldName = 'appointmentContactEmailWarning';
    const warningText = 'Email is required for appointment attendees. Contacts without an email address are disabled.';
    const filteredContactList = [];
    const disabledContactIds = [];
    for (const c of contactInfo) {
      const missingEmail = appointmentEmailFilter && !hasContactEmail(c);
      if (missingEmail) {
        disabledContactIds.push(String(c.id));
      }
      filteredContactList.push({
        const: c.id,
        title: c.name,
        description: `${c.type} - ${c.id}${missingEmail ? ' (No email address)' : ''}`,
      });
    }
    const filteredContactIds = filteredContactList.map((c) => String(c.const));
    const filteredContactNames = filteredContactList.map((c) => String(c.title));
    return {
      id: pageId,
      title: 'Select Contact to Add',
      type: 'page',
      schema: {
        type: 'object',
        properties: {
          ...(appointmentEmailFilter
            ? {
              [warningFieldName]: {
                type: 'string',
                title: '',
                description: warningText,
              },
            }
            : {}),
          contactList: {
            ...(appointment
              ? {
                type: 'array',
                title: 'Contacts',
                items: {
                  type: 'string',
                  enum: filteredContactIds,
                  enumNames: filteredContactNames,
                  ...(disabledContactIds.length > 0
                    ? { enumDisabled: disabledContactIds }
                    : {}),
                },
                uniqueItems: true,
                minItems: 1,
              }
              : {
                type: 'string',
                title: 'Contacts',
                oneOf: filteredContactList,
              }),
          },
        },
      },
      uiSchema: {
        ...(appointment
          ? {
            submitButtonOptions: {
              submitText: 'Add',
            },
          }
          : {}),
        ...(appointmentEmailFilter
          ? {
            [warningFieldName]: {
              'ui:field': 'admonition',
              'ui:severity': 'warning',
            },
            'ui:order': [warningFieldName, 'contactList'],
          }
          : {}),
        contactList: {
          ...(appointment
            ? {
              'ui:widget': 'checkboxes',
              ...(disabledContactIds.length > 0
                ? {
                  // Different JSONSchema form renderers use different keys for per-enum disables.
                  // We provide all common variants.
                  'ui:enumDisabled': disabledContactIds,
                  'ui:options': {
                    enumDisabled: disabledContactIds,
                  },
                }
                : {}),
            }
            : {
              'ui:field': 'list',
              // "ui:showIconAsAvatar": true, // optional, default true. show icon as avatar (round) in list
            }),
        },
      },
      formData: {
        search: contactSearch ?? '',
        contactPhoneNumber,
        contactInfo,
        ...(formData || {}),
      },
    };
  }
}

const customContactSearchCore = {
  getCustomContactSearch,
  getCustomContactSearchData,
};

export default customContactSearchCore;

