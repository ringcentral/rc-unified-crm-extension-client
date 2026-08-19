import outboundCallIcon from '../images/outboundCallIcon.png';
import inboundCallIcon from '../images/inboundCallIcon.png';
import smsMessageIcon from '../images/smsMessageIcon.png';
import logCore from '../core/log';
import { t } from '../i18n';
import { buildContactOptions, buildAdditionalFieldsSchema, buildContactWarningField, buildNewContactWidget, getContactFieldOptions } from './logPageUtils';

type UnknownRecord = Record<string, any>;

function getLogPageRender({ id, manifest, logType, triggerType, platformName, direction, contactInfo, logInfo, loggedContactId, isUnresolved, contactPhoneNumber, useContactSearch, showActivityTitle, messageDate }: UnknownRecord): UnknownRecord {
    const contactList = buildContactOptions(contactInfo, useContactSearch);
    const defaultContact = contactList.some(c => c.toNumberEntity) ? contactList.find(c => c.toNumberEntity) : (contactList[0] ?? null);
    const hasOnlyContactSearch = contactList.length === 1 && defaultContact.const === 'searchContact';
    const defaultContactName = hasOnlyContactSearch ? '' : (defaultContact?.title ?? '');
    const defaultActivityTitle = direction === 'Inbound' ?
        t('pages.log.inboundCallFrom', { type: logType, name: defaultContactName }) :
        t('pages.log.outboundCallTo', { type: logType, name: defaultContactName });
    let callSchemas: UnknownRecord = {};
    let callUISchemas: UnknownRecord = {};
    let callFormData: UnknownRecord = {};
    if (logType === 'Call') {
        callSchemas = {
            activityTitle: {
                title: t('pages.log.activityTitle'),
                type: 'string',
                manuallyEdited: false
            },
            note: {
                title: t('pages.log.note'),
                type: 'string'
            },
            scheduleCallback: {
                title: t('pages.log.scheduleCallback'),
                type: 'boolean'
            },
            callbackDateTime: {
                title: t('pages.log.callbackTime'),
                type: 'string',
                format: 'date-time',
                minimum: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
            }
        }
        callUISchemas = {
            activityTitle: {
                "ui:placeholder": t('pages.log.enterTitle'),
            },
            note: {
                "ui:placeholder": t('pages.log.enterNote'),
                "ui:widget": "textarea",
            },
            scheduleCallback: {
                "ui:help": t('pages.log.addToCalldownList')
            },
            callbackDateTime: {
                "ui:widget": "datetime",
                "ui:options": {
                    minimum: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
                }
            },
            submitButtonOptions: {
                "ui:disabled": false
            }
        }
        callFormData = {
            activityTitle: logInfo?.subject ? logInfo.subject : defaultActivityTitle,
            note: logInfo?.note ?? '',
            scheduleCallback: false,
            callbackDateTime: ''
        }
    }
    // Editable, prefilled title for message logging (e.g. the "log selected
    // messages" flow). Kept separate from the call `activityTitle` above so it
    // only appears when the caller opts in via `showActivityTitle`.
    let messageTitleSchemas: UnknownRecord = {};
    let messageTitleUISchemas: UnknownRecord = {};
    let messageTitleFormData: UnknownRecord = {};
    if (logType === 'Message' && showActivityTitle) {
        const messageTitleName = defaultContactName || contactPhoneNumber || '';
        const messageTitleDate = messageDate ?? '';
        messageTitleSchemas = {
            activityTitle: {
                title: t('pages.log.activityTitle'),
                type: 'string',
                manuallyEdited: false,
                // Stash the (immutable) message timestamp so the title can be
                // regenerated with the same date when the contact changes.
                messageDate: messageTitleDate
            }
        };
        messageTitleUISchemas = {
            activityTitle: {
                "ui:placeholder": t('pages.log.enterTitle'),
            }
        };
        messageTitleFormData = {
            activityTitle: logInfo?.subject ? logInfo.subject : t('pages.log.messageLogTitle', { name: messageTitleName, date: messageTitleDate })
        };
    }
    let page: UnknownRecord = {};
    let allAdditionalFields = logType === 'Call' ? manifest.platforms[platformName].page?.callLog?.additionalFields : manifest.platforms[platformName].page?.messageLog?.additionalFields;
    if (defaultContact.isNewContact && !!manifest.platforms[platformName].page?.newContact?.additionalFields) {
        allAdditionalFields = allAdditionalFields.concat(manifest.platforms[platformName].page.newContact.additionalFields);
    }
    if (allAdditionalFields) {
        allAdditionalFields = allAdditionalFields.filter(f => !f.showIfContactType || f.showIfContactType.length === 0 || f.showIfContactType.includes(defaultContact.type ?? defaultContact.defaultContactType));
    }
    const { additionalFields, additionalFieldsValue, additionalWarningUISchemas, requiredFieldNames } =
        buildAdditionalFieldsSchema({ allAdditionalFields, contact: defaultContact, logInfo });
    switch (triggerType) {
        case 'createLog':
        case 'manual':
        case 'auto':
            const warningField = buildContactWarningField(contactList, defaultContact);
            if (contactList.length === 1 && contactList.some(c => c.isNewContact)) { requiredFieldNames.push('newContactName') };
            if (hasOnlyContactSearch) { requiredFieldNames.push('contact') };
            const newContactWidget = buildNewContactWidget(defaultContact, manifest, platformName);
            page = {
                title: t('pages.log.saveTo', { platform: manifest.platforms[platformName].displayName }), // optional
                schema: {
                    type: 'object',
                    required: requiredFieldNames,
                    properties: {
                        ...warningField,
                        id: {
                            type: 'string'
                        },
                        contact: {
                            title: hasOnlyContactSearch ? defaultContact.title : t('common.labels.contact'),
                            type: 'string',
                            oneOf: contactList
                        },
                        newContactName: {
                            title: t('pages.log.newContactName'),
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
                            title: t('pages.log.contactType'),
                            type: 'string',
                            oneOf: manifest.platforms[platformName].contactTypes?.map(ct => { return { const: ct.value, title: ct.display } }) ?? [],
                        },
                        ...callSchemas,
                        ...messageTitleSchemas,
                        ...additionalFields
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
                    contact: hasOnlyContactSearch ? {
                            "ui:field": "button",
                            "ui:variant": "contained",
                            "ui:fullWidth": true
                    } : {},
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
                        submitText: t('common.buttons.save'),
                    },
                    ...callUISchemas,
                    ...messageTitleUISchemas,
                    ...newContactWidget,
                    ...additionalWarningUISchemas,
                    // Always render scheduling fields at the end
                    "ui:order": ["*", "scheduleCallback", "callbackDateTime"]
                },
                formData: {
                    id,
                    contact: hasOnlyContactSearch ? '' : defaultContact.const,
                    newContactType: defaultContact.defaultContactType ?? '',
                    newContactName: '',
                    contactType: defaultContact?.type ?? '',
                    contactName: defaultContactName,
                    triggerType,
                    logType,
                    contactPhoneNumber,
                    isUnresolved: !!isUnresolved,
                    ...callFormData,
                    ...messageTitleFormData,
                    ...additionalFieldsValue
                }
            }
            if (hasOnlyContactSearch) {
                page.uiSchema.submitButtonOptions = {
                    ...page.uiSchema.submitButtonOptions,
                    "ui:disabled": true
                };
            }
            // Hide callbackDateTime when scheduleCallback is false
            if (!page.formData.scheduleCallback) {
                page.uiSchema.callbackDateTime = { "ui:widget": "hidden" };
            }
            break;
        case 'editLog':
            page = {
                title: t('pages.log.editLog'), // optional
                schema: {
                    type: 'object',
                    required: ['activityTitle'],
                    properties: {
                        id: {
                            type: 'string'
                        },
                        contact: {
                            title: t('common.labels.contact'),
                            type: 'string',
                            oneOf: contactList,
                            readOnly: true
                        },
                        activityTitle: {
                            title: t('pages.log.activityTitle'),
                            type: 'string'
                        },
                        note: {
                            title: t('pages.log.note'),
                            type: 'string'
                        },
                        ...additionalFields
                    }
                },
                uiSchema: {
                    id: {
                        "ui:widget": "hidden",
                    },
                    note: {
                        "ui:placeholder": t('pages.log.enterNote'),
                        "ui:widget": "textarea",
                    },
                    callbackDateTime: {
                        "ui:widget": "datetime",
                        "ui:options": {
                            minimum: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
                        }
                    },
                    submitButtonOptions: {
                        submitText: t('common.buttons.update'),
                    },
                    ...additionalWarningUISchemas,
                    // Always render scheduling fields at the end
                    "ui:order": ["*", "scheduleCallback", "callbackDateTime"]
                },
                formData: {
                    id,
                    contact: loggedContactId ?? defaultContact.const,
                    activityTitle: logInfo?.subject ?? '',
                    triggerType,
                    note: logInfo?.note ?? '',
                    contactPhoneNumber,
                    scheduleCallback: false,
                    callbackDateTime: '',
                    ...additionalFieldsValue
                }
            }
            break;
    }
    return page;
}

function getUpdatedLogPageRender({ manifest, logType, platformName, updateData }: UnknownRecord): UnknownRecord {
    const updatedFieldKey = updateData.keys[0];
    let page = updateData.page;
    // update target field value
    page.formData = updateData.formData;
    const contact = page.schema.properties.contact.oneOf.find(c => c.const === page.formData.contact);
    switch (updatedFieldKey) {
        case 'scheduleCallback':
            if (page.formData.scheduleCallback) {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                page.uiSchema.callbackDateTime = {
                    "ui:widget": "datetime",
                    "ui:options": {
                        minimum: todayStart.toISOString()
                    }
                };
                page.schema.properties.callbackDateTime = {
                    ...(page.schema.properties.callbackDateTime || { title: t('pages.log.callbackTime'), type: 'string', format: 'date-time' }),
                    minimum: todayStart.toISOString()
                };
                // mark callback time as required so Save disables until provided
                if (!Array.isArray(page.schema.required)) {
                    page.schema.required = [];
                }
                if (!page.schema.required.includes('callbackDateTime')) {
                    page.schema.required.push('callbackDateTime');
                }
                // disable Save until a callback time is provided
                page.uiSchema.submitButtonOptions = {
                    ...page.uiSchema.submitButtonOptions,
                    "ui:disabled": !page.formData.callbackDateTime
                };
            } else {
                page.uiSchema.callbackDateTime = { "ui:widget": "hidden" };
                page.formData.callbackDateTime = '';
                // remove required flag when scheduling is off
                if (Array.isArray(page.schema.required)) {
                    page.schema.required = page.schema.required.filter(r => r !== 'callbackDateTime');
                }
                // enable Save when scheduling is off
                page.uiSchema.submitButtonOptions = {
                    ...page.uiSchema.submitButtonOptions,
                    "ui:disabled": false
                };
            }
            break;
        case 'callbackDateTime':
            if (page.formData.callbackDateTime) {
                const selectedDate = new Date(page.formData.callbackDateTime);
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                if (selectedDate < todayStart) {
                    page.formData.callbackDateTime = '';
                }
            }
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            if (page.uiSchema.callbackDateTime && page.uiSchema.callbackDateTime["ui:widget"] === "datetime") {
                page.uiSchema.callbackDateTime = {
                    "ui:widget": "datetime",
                    "ui:options": {
                        minimum: todayStart.toISOString()
                    }
                };
            }
            page.schema.properties.callbackDateTime = {
                ...page.schema.properties.callbackDateTime,
                minimum: todayStart.toISOString()
            };
            page.uiSchema.submitButtonOptions = {
                ...page.uiSchema.submitButtonOptions,
                "ui:disabled": (page.formData.scheduleCallback === true) && !page.formData.callbackDateTime
            };
            break;
        case 'contact':
            // New contact fields
            if (contact.isNewContact) {
                if (manifest.platforms[platformName].contactTypes?.length > 0) {
                    page.uiSchema.newContactType = {};
                }
                page.uiSchema.newContactName = {
                    "ui:placeholder": t('pages.log.enterName'),
                };
                if (!page.schema.required.includes('newContactName')) {
                    page.schema.required.push('newContactName');
                }
                if (!!page.schema.properties.activityTitle && !page.schema.properties.activityTitle?.manuallyEdited) {
                    page.formData.activityTitle = logType === 'Message' ?
                        t('pages.log.messageLogTitle', { name: '', date: page.schema.properties.activityTitle?.messageDate ?? '' }) :
                        (page.formData.activityTitle.startsWith('Inbound') ?
                            t('pages.log.inboundCallFrom', { type: 'call', name: '' }) :
                            t('pages.log.outboundCallTo', { type: 'call', name: '' }));
                }
                page.formData.newContactType = manifest.platforms[platformName].contactTypes?.length > 0 ? manifest.platforms[platformName].contactTypes[0].value : '';
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
                    page.formData.activityTitle = logType === 'Message' ?
                        t('pages.log.messageLogTitle', { name: contact.title, date: page.schema.properties.activityTitle?.messageDate ?? '' }) :
                        (page.formData.activityTitle.startsWith('Inbound') ?
                            t('pages.log.inboundCallFrom', { type: 'call', name: contact.title }) :
                            t('pages.log.outboundCallTo', { type: 'call', name: contact.title }));
                }
            }
            page.formData.contactType = contact.type;
            page.formData.contactName = contact.title;

            // Additional fields
            const allAssociationFields = Object.keys(page.schema.properties);
            for (const af of allAssociationFields) {
                if (page.schema.properties[af].associationField) {
                    delete page.schema.properties[af];
                    delete page.formData[af];
                }
            }
            let additionalFields: UnknownRecord = {};
            let additionalFieldsValue: UnknownRecord = {};
            const addiitionalWarningUISchemas: UnknownRecord = {};
            let allAdditionalFields = logType === 'Call' ?
                manifest.platforms[platformName].page?.callLog?.additionalFields :
                manifest.platforms[platformName].page?.messageLog?.additionalFields;
            if (contact.isNewContact) {
                allAdditionalFields = allAdditionalFields.concat(manifest.platforms[platformName].page?.newContact?.additionalFields);
            }
            if (allAdditionalFields) {
                const fieldsToRemove = allAdditionalFields.filter(f => f.showIfContactType && f.showIfContactType.length > 0 && !f.showIfContactType.includes(contact.type));
                for (const f of fieldsToRemove) {
                    delete page.schema.properties[f.const];
                    delete page.formData[f.const];
                    delete page.uiSchema[f.const];
                }
                allAdditionalFields = allAdditionalFields.filter(f => !fieldsToRemove.includes(f));
            }
            if (allAdditionalFields) {
                for (const f of allAdditionalFields) {
                    if (contact.ignoreAdditionalFields) {
                        continue;
                    }
                    switch (f.type) {
                        case 'selection':
                            if (f.contactDependent && (contact?.additionalInfo?.[f.const] === undefined)) {
                                continue;
                            }
                            const baseOptions = getContactFieldOptions(f, contact, page.formData.newContactType);
                            const includeNoneOption = f.includeNoneOption !== false;
                            additionalFields[f.const] = {
                                title: f.title,
                                type: 'string',
                                oneOf: includeNoneOption ? [...baseOptions, { const: 'none', title: t('common.labels.none') }] : baseOptions,
                                associationField: f.contactDependent
                            }
                            if (f.contactDependent) {
                                additionalFieldsValue[f.const] = baseOptions[0]?.const;
                            }
                            else if (f.contactTypeDependent && !baseOptions.some(option => option.const === page.formData[f.const])) {
                                additionalFieldsValue[f.const] = undefined;
                            }
                            else {
                                additionalFieldsValue[f.const] = page.formData[f.const];
                            }
                            if (f.required) {
                                page.schema.required.push(f.const);
                            }
                            break;
                        case 'checkbox':
                            if (f.contactDependent && (contact?.additionalInfo?.[f.const] === undefined)) {
                                contact.additionalInfo[f.const] = false;
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
                            if (f.required) {
                                page.schema.required.push(f.const);
                            }
                            break;
                        case 'inputField':
                            if (f.contactDependent && (contact?.additionalInfo?.[f.const] ?? false)) {
                                continue;
                            }
                            additionalFields[f.const] = {
                                title: f.title,
                                type: 'string',
                                associationField: f.contactDependent
                            }
                            additionalFieldsValue[f.const] = f.contactDependent ?
                                f.defaultValue :
                                page.formData[f.const];
                            if (f.required) {
                                page.schema.required.push(f.const);
                            }
                            break;
                        case 'warning':
                            additionalFields[f.const] = {
                                title: f.title,
                                type: 'string',
                                description: f.description
                            }
                            addiitionalWarningUISchemas[f.const] = {
                                "ui:field": "admonition", // or typography to show raw text
                                "ui:severity": "warning", // "warning", "info", "error", "success"
                            }
                            break;
                    }
                }
            }
            page.schema.properties = {
                ...page.schema.properties,
                ...additionalFields
            }
            page.formData = {
                ...page.formData,
                ...additionalFieldsValue
            }
            page.uiSchema = {
                ...page.uiSchema,
                ...addiitionalWarningUISchemas
            }
            // Hide callbackDateTime when scheduleCallback is false
            if (!page.formData.scheduleCallback) {
                page.uiSchema.callbackDateTime = { "ui:widget": "hidden" };
            }
            break;
        case 'newContactType':
            // deprecated
            const contactTypeDependentFields = manifest.platforms[platformName].page?.newContact?.additionalFields?.filter(f => f.contactTypeDependent) ?? [];
            for (const f of contactTypeDependentFields) {
                const options = getContactFieldOptions(f, contact, page.formData.newContactType);
                const includeNoneOption = f.includeNoneOption !== false;
                page.schema.properties[f.const] = {
                    ...page.schema.properties[f.const],
                    title: f.title,
                    type: 'string',
                };
                page.schema.properties[f.const].oneOf = [
                    ...options,
                    ...(includeNoneOption ? [{ const: 'none', title: t('common.labels.none') }] : [])
                ];
                if (page.formData[f.const] !== 'none' && !options.some(option => option.const === page.formData[f.const])) {
                    delete page.formData[f.const];
                }
            }

            // New contact fields
            const newContactFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
            for (const f of newContactFields) {
                if (f.contactTypeDependent) {
                    continue;
                }
                if (f.showIfContactType && f.showIfContactType.length > 0 && !f.showIfContactType.includes(page.formData.newContactType)) {
                    // to remove
                    delete page.schema.properties[f.const];
                    delete page.formData[f.const];
                    delete page.uiSchema[f.const];
                    continue;
                }
                page.schema.properties[f.const] = {
                    title: f.title,
                    type: 'string',
                    oneOf: [...contact.additionalInfo?.[f.const] ?? [], { const: 'none', title: t('common.labels.none') }]
                }
            }
            break;
        case 'newContactName':
            if (!!page.schema.properties.activityTitle && !page.schema.properties.activityTitle.manuallyEdited) {
                page.formData.activityTitle = logType === 'Message' ?
                    t('pages.log.messageLogTitle', { name: page.formData.newContactName, date: page.schema.properties.activityTitle?.messageDate ?? '' }) :
                    (page.formData.activityTitle.startsWith('Inbound') ?
                        t('pages.log.inboundCallFrom', { type: 'call', name: page.formData.newContactName }) :
                        t('pages.log.outboundCallTo', { type: 'call', name: page.formData.newContactName }));
            }
            break;
        case 'activityTitle':
            page.schema.properties.activityTitle.manuallyEdited = true;
            break;
    }

    if (page.schema.properties[updatedFieldKey]?.pattern) {
        const patternRegex = new RegExp(page.schema.properties[updatedFieldKey].pattern)
        if (!page.formData[updatedFieldKey] || patternRegex.test(page.formData[updatedFieldKey])) {
            delete page.schema.properties[`${updatedFieldKey}-error`];
            delete page.uiSchema[`${updatedFieldKey}-error`];
        }
        else {
            page.schema.properties[`${updatedFieldKey}-error`] = {
                type: 'string',
                description: t('notifications.error.wrongFormat', { field: page.schema.properties[updatedFieldKey].title ?? updatedFieldKey })
            };
            page.uiSchema[`${updatedFieldKey}-error`] = {
                "ui:field": "admonition", // or typography to show raw text
                "ui:severity": "error", // "warning", "info", "error", "success"
            };
        }
    }
    const contactOptions = page.schema.properties.contact?.oneOf ?? [];
    if (contactOptions.length === 1 && contactOptions[0].const === 'searchContact') {
        if (!Array.isArray(page.schema.required)) {
            page.schema.required = [];
        }
        if (!page.schema.required.includes('contact')) {
            page.schema.required.push('contact');
        }
        page.formData.contact = '';
        page.uiSchema.submitButtonOptions = {
            ...page.uiSchema.submitButtonOptions,
            "ui:disabled": true
        };
    }
    return page;
}

function getUnloggedCallPageRender({ unloggedCalls }: UnknownRecord): UnknownRecord {
    const logsList: UnknownRecord[] = []
    const today = new Date();
    const todayDateString = today.toDateString();

    for (const c of unloggedCalls) {
        const { title, description, type } = logCore.getConflictContentFromUnresolvedLog(c);
        const callDate = new Date(c.startTime);
        const callDateString = callDate.toDateString();
        const duration = formatDuration(c.duration);
        // If same date as today, show only time (HH:mm), otherwise show full date
        const meta = callDateString === todayDateString
            ? `${callDate.getHours().toString().padStart(2, '0')}:${callDate.getMinutes().toString().padStart(2, '0')}`
            : callDate.toLocaleDateString();

        logsList.push({
            const: c.sessionId,
            title,
            description: description ? `${duration} - ${description}` : duration,
            meta,
            icon: type === 'Message' ? smsMessageIcon : (c.direction === 'Inbound' ? inboundCallIcon : outboundCallIcon),
        });
    }
    return {
        id: 'unloggedCallPage',
        title: t('pages.unloggedCalls.title'),
        type: 'page',
        unreadCount: Object.keys(unloggedCalls).length,
        // schema and uiSchema are used to customize page, api is the same as [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form)
        schema: {
            type: 'object',
            required: [],
            properties: {
                record: {
                    type: "string",
                    oneOf: logsList
                },
            },
        },
        uiSchema: {
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

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    else {
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

const logPage = {
    getLogPageRender,
    getUpdatedLogPageRender,
    getUnloggedCallPageRender,
};

export {
    getLogPageRender,
    getUpdatedLogPageRender,
    getUnloggedCallPageRender,
};

export default logPage;
