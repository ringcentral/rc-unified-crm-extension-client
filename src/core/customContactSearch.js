import axios from 'axios';
import { showNotification } from '../lib/util';

function getCustomContactSearch({
    contactSearchAdapterButton = "contactSearchAdapterButton",
    contactPhoneNumber,
    appointment = false,
    emailMandatoryInAttendee,
    formData = {},
}) {
    const warningFieldName = 'appointmentContactSearchWarning';
    const warningText = 'Only contacts with an email address will be shown in search results.';
    const resolvedEmailMandatoryInAttendee =
        emailMandatoryInAttendee ??
        formData?.appointmentCreateDraft?.emailMandatoryInAttendee ??
        formData?.appointmentEditDraft?.emailMandatoryInAttendee;
    const showEmailWarning = appointment && resolvedEmailMandatoryInAttendee !== false;
    return {
        id: 'searchContact',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                ...(showEmailWarning
                    ? {
                        [warningFieldName]: {
                            type: 'string',
                            title: '',
                            description: warningText,
                        },
                    }
                    : {}),
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
            ...(showEmailWarning
                ? {
                    [warningFieldName]: {
                        "ui:field": "admonition",
                        "ui:severity": "warning",
                    },
                }
                : {}),
            contactNameToSearch: {
                "ui:placeholder": 'enter contact name to search',
            },
            [contactSearchAdapterButton]: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            },
            "ui:order": appointment
                ? [warningFieldName, "contactNameToSearch", contactSearchAdapterButton]
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
            ...(appointmentEmailFilter ? { appointment: true } : {}),
        },
    });
    if (contactRes.data.contact.length === 0) {
        showNotification({
            level: contactRes.data.returnMessage.messageType, message: contactRes.data.returnMessage.message, ttl: contactRes.data.returnMessage.ttl
        });
    } else {
        const contactInfo = contactRes.data.contact;
        const filteredContactList = [];
        for (const c of contactInfo) {
            filteredContactList.push({
                const: c.id,
                title: c.name,
                description: `${c.type} - ${c.id}`
            })
        }
        const warningFieldName = 'appointmentContactSearchWarning';
        const warningText = 'Only contacts with an email address will be shown in search results.';
        const showEmailWarning = appointment && resolvedEmailMandatoryInAttendee !== false;
        const filteredContactIds = filteredContactList.map((c) => String(c.const));
        const filteredContactNames = filteredContactList.map((c) => String(c.title));
        return {
            id: pageId,
            title: 'Select Contact to Add',
            type: 'page',
            schema: {
                type: 'object',
                properties: {
                    ...(showEmailWarning
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
                ...(showEmailWarning
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