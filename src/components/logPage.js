const outboundCallIcon = require('../images/outboundCallIcon.png');
const inboundCallIcon = require('../images/inboundCallIcon.png');
const conflictLogIcon = require('../images/conflictLogIcon.png');
const logCore = require('../core/log');

function getLogPageRender({ id, manifest, logType, triggerType, platformName, direction, contactInfo, subject, note, loggedContactId, isUnresolved }) {
    const additionalChoiceFields = logType === 'Call' ?
        manifest.platforms[platformName].page?.callLog?.additionalFields?.filter(f => f.type === 'selection') ?? [] :
        manifest.platforms[platformName].page?.messageLog?.additionalFields?.filter(f => f.type === 'selection') ?? [];
    const additionalCheckBoxFields = logType === 'Call' ?
        manifest.platforms[platformName].page?.callLog?.additionalFields?.filter(f => f.type === 'checkbox') ?? [] :
        manifest.platforms[platformName].page?.messageLog?.additionalFields?.filter(f => f.type === 'checkbox') ?? [];
    const additionalInputFields = logType === 'Call' ?
        manifest.platforms[platformName].page?.callLog?.additionalFields?.filter(f => f.type === 'inputField') ?? [] :
        manifest.platforms[platformName].page?.messageLog?.additionalFields?.filter(f => f.type === 'inputField') ?? [];
    // format contact list
    const contactList = contactInfo.map(c => { return { const: c.id, title: c.name, type: c.type, description: c.type ? `${c.type} - ${c.id}` : '', additionalInfo: c.additionalInfo, isNewContact: !!c.isNewContact } });
    const defaultActivityTitle = direction === 'Inbound' ?
        `Inbound ${logType} from ${contactList[0]?.title ?? ''}` :
        `Outbound ${logType} to ${contactList[0]?.title ?? ''}`;
    let callSchemas = {};
    let callUISchemas = {};
    let callFormData = {};
    if (logType === 'Call') {
        callSchemas = {
            activityTitle: {
                title: 'Activity title',
                type: 'string',
                manuallyEdited: false
            },
            note: {
                title: 'Note',
                type: 'string'
            }
        }
        callUISchemas = {
            activityTitle: {
                "ui:placeholder": 'Enter title...',
            },
            note: {
                "ui:placeholder": 'Enter note...',
                "ui:widget": "textarea",
            }
        }
        callFormData = {
            activityTitle: (!!subject & subject !== '') ? subject : defaultActivityTitle,
            note: note ?? '',
        }
    }
    let page = {};
    switch (triggerType) {
        case 'createLog':
        case 'manual':
        case 'auto':
            let additionalFields = {};
            let additionalFieldsValue = {};
            for (const f of additionalChoiceFields) {
                if (!contactList[0]?.additionalInfo?.hasOwnProperty(f.const)) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'string',
                    oneOf: [...contactList[0].additionalInfo[f.const], { const: 'none', title: 'None' }],
                    associationField: !!f.contactDependent
                }
                additionalFieldsValue[f.const] = contactList[0].additionalInfo[f.const][0].const;
            }
            for (const f of additionalCheckBoxFields) {
                if (!contactList[0]?.additionalInfo?.hasOwnProperty(f.const)) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'boolean',
                    associationField: !!f.contactDependent
                }
                additionalFieldsValue[f.const] = f.defaultValue ?? false;
            }
            for (const f of additionalInputFields) {
                if (!contactList[0]?.additionalInfo?.hasOwnProperty(f.const)) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'string',
                    associationField: !!f.contactDependent
                }
                additionalFieldsValue[f.const] = f.defaultValue ?? '';
            }
            let warningField = {};
            if (contactList.length > 2) {
                warningField = {
                    warning: {
                        type: 'string',
                        description: "Multiple contacts found. Please select the contact to associate this activity with.",
                    }
                };
            }
            else if (contactList.length === 1) {
                warningField = {
                    warning: {
                        type: 'string',
                        description: "No contact found. Enter a name to have a placeholder contact made for you.",
                    }
                };
            }
            let requiredFieldNames = [];
            if (contactList.length === 1) { requiredFieldNames = ['newContactName'] };
            let newContactWidget = {
                newContactName: {
                    "ui:widget": "hidden",
                },
                newContactType: {
                    "ui:widget": "hidden",
                }
            }
            if (contactList[0].isNewContact) {
                if (!!manifest.platforms[platformName].contactTypes) {
                    newContactWidget.newContactType = {};
                }
                newContactWidget.newContactName = {
                    "ui:placeholder": 'Enter name...',
                };
            }
            page = {
                title: `Save to ${platformName}`, // optional
                schema: {
                    type: 'object',
                    required: requiredFieldNames,
                    properties: {
                        ...warningField,
                        id: {
                            type: 'string'
                        },
                        contact: {
                            title: 'Contact',
                            type: 'string',
                            oneOf: contactList
                        },
                        newContactName: {
                            title: 'New contact name',
                            type: 'string',
                        },
                        contactType: {
                            title: '',
                            type: 'string'
                        },
                        contactName: {
                            title: '',
                            type: 'string'
                        },
                        triggerType: {
                            title: '',
                            type: 'string'
                        },
                        isUnresolved: {
                            title: '',
                            type: 'boolean'
                        },
                        logType: {
                            title: '',
                            type: 'string'
                        },
                        newContactType: {
                            title: 'Contact type',
                            type: 'string',
                            oneOf: manifest.platforms[platformName].contactTypes?.map(t => { return { const: t.value, title: t.display } }) ?? [],
                        },
                        ...callSchemas,
                        ...additionalFields,
                        removeUnresolveButton: {
                            "type": "string",
                            "title": "Remove from unresolved list",
                        }
                    }
                },
                uiSchema: {
                    id: {
                        "ui:widget": "hidden",
                    },
                    warning: {
                        "ui:field": "admonition", // or typography to show raw text
                        "ui:severity": "warning", // "warning", "info", "error", "success"
                    },
                    contactType: {
                        "ui:widget": "hidden",
                    },
                    contactName: {
                        "ui:widget": "hidden",
                    },
                    triggerType: {
                        "ui:widget": "hidden",
                    },
                    logType: {
                        "ui:widget": "hidden",
                    },
                    isUnresolved: {
                        "ui:widget": "hidden",
                    },
                    submitButtonOptions: {
                        submitText: 'Save',
                    },
                    removeUnresolveButton: {
                        "ui:field": "button",
                        "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                        "ui:fullWidth": true,
                        "ui:color": "danger.b03",
                        "ui:widget": isUnresolved ? "show" : "hidden",
                    },
                    ...callUISchemas,
                    ...newContactWidget
                },
                formData: {
                    id,
                    contact: contactList[0].const,
                    newContactType: manifest.platforms[platformName].contactTypes ? manifest.platforms[platformName].contactTypes[0].value : '',
                    newContactName: '',
                    contactType: contactList[0]?.type ?? '',
                    contactName: contactList[0]?.title ?? '',
                    triggerType,
                    logType,
                    isUnresolved: !!isUnresolved,
                    ...callFormData,
                    ...additionalFieldsValue
                }
            }
            break;
        case 'editLog':
            page = {
                title: `Edit log`, // optional
                schema: {
                    type: 'object',
                    required: ['activityTitle'],
                    properties: {
                        id: {
                            type: 'string'
                        },
                        contact: {
                            title: 'Contact',
                            type: 'string',
                            oneOf: contactList,
                            readOnly: true
                        },
                        activityTitle: {
                            title: 'Activity title',
                            type: 'string'
                        },
                        note: {
                            title: 'Note',
                            type: 'string'
                        }
                    }
                },
                uiSchema: {
                    id: {
                        "ui:widget": "hidden",
                    },
                    note: {
                        "ui:placeholder": 'Enter note...',
                        "ui:widget": "textarea",
                    },
                    submitButtonOptions: {
                        submitText: 'Update',
                    }
                },
                formData: {
                    id,
                    contact: loggedContactId ?? contactList[0].const,
                    activityTitle: subject ?? '',
                    triggerType,
                    note: note ?? ''
                }
            }
            break;
    }
    return page;
}

function getUpdatedLogPageRender({ manifest, logType, platformName, updateData }) {
    const updatedFieldKey = updateData.keys[0];
    let page = updateData.page;
    // update target field value
    page.formData = updateData.formData;
    const additionalChoiceFields = logType === 'Call' ?
        manifest.platforms[platformName].page?.callLog?.additionalFields?.filter(f => f.type === 'selection') ?? [] :
        manifest.platforms[platformName].page?.messageLog?.additionalFields?.filter(f => f.type === 'selection') ?? [];
    const additionalCheckBoxFields = logType === 'Call' ?
        manifest.platforms[platformName].page?.callLog?.additionalFields?.filter(f => f.type === 'checkbox') ?? [] :
        manifest.platforms[platformName].page?.messageLog?.additionalFields?.filter(f => f.type === 'checkbox') ?? [];
    switch (updatedFieldKey) {
        case 'contact':
            const contact = page.schema.properties.contact.oneOf.find(c => c.const === page.formData.contact);
            // New contact fields
            if (contact.isNewContact) {
                if (!!manifest.platforms[platformName].contactTypes) {
                    page.uiSchema.newContactType = {};
                }
                page.uiSchema.newContactName = {
                    "ui:placeholder": 'Enter name...',
                };
                page.schema.required = ['newContactName'];
                if (!!page.schema.properties.activityTitle && !page.schema.properties.activityTitle?.manuallyEdited) {
                    page.formData.activityTitle = page.formData.activityTitle.startsWith('Inbound') ?
                        'Inbound call from ' :
                        'Outbound call to ';
                }
            }
            else {
                page.formData.newContactName = '';
                page.formData.newContactType = '';
                page.uiSchema.newContactType = {
                    "ui:widget": "hidden",
                };
                page.uiSchema.newContactName = {
                    "ui:widget": "hidden",
                };
                page.schema.required = [];
                if (!!page.schema.properties.activityTitle && !page.schema.properties.activityTitle?.manuallyEdited) {
                    page.formData.activityTitle = page.formData.activityTitle.startsWith('Inbound') ?
                        `Inbound call from ${contact.title}` :
                        `Outbound call to ${contact.title}`;
                }
            }
            page.formData.contactType = contact.type;
            page.formData.contactName = contact.title;

            // Additional fields
            const allAssociationFields = Object.keys(page.schema.properties);
            for (const af of allAssociationFields) {
                if (!!page.schema.properties[af].associationField) {
                    delete page.schema.properties[af];
                    delete page.formData[af];
                }
            }
            let additionalFields = {};
            let additionalFieldsValue = {};
            for (const f of additionalChoiceFields) {
                if (f.contactDependent && !contact?.additionalInfo?.hasOwnProperty(f.const)) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'string',
                    oneOf: [...contact.additionalInfo[f.const], { const: 'none', title: 'None' }],
                    associationField: f.contactDependent
                }
                additionalFieldsValue[f.const] = f.contactDependent ?
                    contact.additionalInfo[f.const][0].const :
                    page.formData[f.const];
            }
            for (const f of additionalCheckBoxFields) {
                if (f.contactDependent && !contact?.additionalInfo?.hasOwnProperty(f.const)) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'boolean',
                    associationField: f.contactDependent
                }
                additionalFieldsValue[f.const] = f.contactDependent ?
                    f.defaultValue :
                    page.formData[f.const];
            }
            page.schema.properties = {
                ...page.schema.properties,
                ...additionalFields
            }
            page.formData = {
                ...page.formData,
                ...additionalFieldsValue
            }
            break;
        case 'newContactName':
            if (!!page.schema.properties.activityTitle && !page.schema.properties.activityTitle.manuallyEdited) {
                page.formData.activityTitle = page.formData.activityTitle.startsWith('Inbound') ?
                    `Inbound call from ${page.formData.newContactName}` :
                    `Outbound call to ${page.formData.newContactName}`;
            }
            break;
        case 'activityTitle':
            page.schema.properties.activityTitle.manuallyEdited = true;
            break;
    }
    return page;
}

function getUnresolvedLogsPageRender({ unresolvedLogs }) {
    const logsList = []
    for (const cacheId of Object.keys(unresolvedLogs)) {
        const { title, description } = logCore.getConflictContentFromUnresolvedLog(unresolvedLogs[cacheId]);
        logsList.push({
            const: cacheId,
            title,
            description,
            meta: unresolvedLogs[cacheId].date,
            icon: unresolvedLogs[cacheId].direction === 'Inbound' ? inboundCallIcon : outboundCallIcon,
        });
    }
    return {
        id: 'unresolve', // tab id, required
        title: 'Unresolve',
        type: 'tab', // tab type
        hidden: Object.keys(unresolvedLogs).length === 0,
        iconUri: conflictLogIcon, // icon for tab, 24x24
        activeIconUri: conflictLogIcon, // icon for tab in active status, 24x24
        priority: 9,
        unreadCount: Object.keys(unresolvedLogs).length,
        // schema and uiSchema are used to customize page, api is the same as [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form)
        schema: {
            type: 'object',
            required: [],
            properties: {
                "warning": {
                    "type": "string",
                    "description": "Unresolved call logs are listed below. They cannot be auto logged because of conflicts like multiple matched contacts, multiple associations etc."
                },
                "record": {
                    "type": "string",
                    "oneOf": logsList
                },
            },
        },
        uiSchema: {
            warning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            record: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            },
        },
        formData: {
            record: '',
        },
    }
}

exports.getLogPageRender = getLogPageRender;
exports.getUpdatedLogPageRender = getUpdatedLogPageRender;
exports.getUnresolvedLogsPageRender = getUnresolvedLogsPageRender;