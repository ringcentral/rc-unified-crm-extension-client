import axios from 'axios';
import { showNotification } from '../lib/util';

function hasContactEmail(contact) {
    const directEmail = String(
        contact?.email ??
        ''
    ).trim();
    if (directEmail) return true;
    return false;
}

function getCustomContactSearch({
    contactSearchAdapterButton = "contactSearchAdapterButton",
    contactPhoneNumber,
    appointment = false,
    emailMandatoryInAttendee,
    formData = {},
}) {
    return {
        id: 'searchContact',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                contactNameToSearch: {
                    type: 'string',
                    title: 'Contact Search'
                },
                [contactSearchAdapterButton]: {
                    type: 'string',
                    title: 'Search'
                }
            }
        },
        uiSchema: {
            contactNameToSearch: {
                "ui:placeholder": 'enter contact name to search',
            },
            [contactSearchAdapterButton]: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            },
            "ui:order": appointment
                ? ["contactNameToSearch", contactSearchAdapterButton]
                : ["contactNameToSearch", contactSearchAdapterButton],
        },
        formData: {
            contactPhoneNumber,
            appointment,
            ...(formData || {}),
        },
    }
}

async function getCustomContactSearchData({
    serverUrl,
    platform,
    contactSearch,
    pageId,
    contactPhoneNumber,
    appointment = false,
    emailMandatoryInAttendee,
    formData = {},
}) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const resolvedEmailMandatoryInAttendee =
        emailMandatoryInAttendee ??
        formData?.appointmentCreateDraft?.emailMandatoryInAttendee ??
        formData?.appointmentEditDraft?.emailMandatoryInAttendee;
    const appointmentEmailFilter = appointment && resolvedEmailMandatoryInAttendee !== false;
    const contactRes = await axios.get(`${serverUrl}/custom/contact/search`, {
        params: {
            jwtToken: rcUnifiedCrmExtJwt,
            name: contactSearch ?? '',
        },
    });
    if (contactRes.data.contact.length === 0) {
        showNotification({
            level: contactRes.data.returnMessage.messageType, message: contactRes.data.returnMessage.message, ttl: contactRes.data.returnMessage.ttl
        });
    } else {
        const contactInfo = contactRes.data.contact;
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
                description: `${c.type} - ${c.id}${missingEmail ? ' (No email address)' : ''}`
            })
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
                            })
                    }
                }
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
                            "ui:field": "admonition",
                            "ui:severity": "warning",
                        },
                        "ui:order": [warningFieldName, "contactList"],
                    }
                    : {}),
                contactList: {
                    ...(appointment
                        ? {
                            "ui:widget": "checkboxes",
                            ...(disabledContactIds.length > 0
                                ? {
                                    // Different JSONSchema form renderers use different keys for per-enum disables.
                                    // We provide all common variants.
                                    "ui:enumDisabled": disabledContactIds,
                                    "ui:options": {
                                        enumDisabled: disabledContactIds,
                                    },
                                }
                                : {}),
                        }
                        : {
                            "ui:field": "list",
                            // "ui:showIconAsAvatar": true, // optional, default true. show icon as avatar (round) in list
                        }),
                }
            },
            formData: {
                search: contactSearch ?? '',
                contactPhoneNumber,
                contactInfo,
                ...(formData || {}),
            }
        }
    }
}
exports.getCustomContactSearch = getCustomContactSearch;
exports.getCustomContactSearchData = getCustomContactSearchData;
