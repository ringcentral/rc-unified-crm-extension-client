import { t } from '../i18n';

function buildContactOptions(contactInfo, useContactSearch) {
    const contactList = contactInfo.map(c => {
        return {
            const: c.id,
            title: c.name,
            type: c.type,
            description: c.type ? `${c.type} - ${c.id}` : '',
            toNumberEntity: c.toNumberEntity ?? false,
            additionalInfo: c.additionalInfo,
            isNewContact: !!c.isNewContact,
            defaultContactType: c.defaultContactType
        };
    });
    if (useContactSearch) {
        contactList.push({
            const: 'searchContact',
            title: t('pages.log.searchContacts'),
            additionalInfo: null,
            ignoreAdditionalFields: true
        });
    }
    return contactList;
}

// Builds the additionalFields schema, formData values, warning uiSchemas, and required field names
// for a given contact. Mirrors the loop in getLogPageRender (lines 96-181 of logPage.js).
function buildAdditionalFieldsSchema({ allAdditionalFields, contact, logInfo }) {
    const additionalFields = {};
    const additionalFieldsValue = {};
    const additionalWarningUISchemas = {};
    const requiredFieldNames = [];

    if (!allAdditionalFields) {
        return { additionalFields, additionalFieldsValue, additionalWarningUISchemas, requiredFieldNames };
    }

    for (const f of allAdditionalFields) {
        if (!f) {
            continue;
        }
        switch (f.type) {
            case 'selection': {
                if (contact.isNewContact && f.contactTypeDependent) {
                    const baseOptions = [...contact.additionalInfo[contact.defaultContactType][f.const]];
                    const includeNoneOption = f.includeNoneOption !== false;
                    additionalFields[f.const] = {
                        title: f.title,
                        type: 'string',
                        oneOf: includeNoneOption ? [...baseOptions, { const: 'none', title: t('common.labels.none') }] : baseOptions,
                        associationField: !!f.contactDependent
                    };
                } else {
                    if (contact?.additionalInfo?.[f.const] === undefined) {
                        continue;
                    }
                    const baseOptions = [...contact.additionalInfo[f.const]];
                    const includeNoneOption = f.includeNoneOption !== false;
                    additionalFields[f.const] = {
                        title: f.title,
                        type: 'string',
                        oneOf: includeNoneOption ? [...baseOptions, { const: 'none', title: t('common.labels.none') }] : baseOptions,
                        associationField: !!f.contactDependent
                    };
                }
                if (logInfo?.dispositions?.[f.const]) {
                    additionalFieldsValue[f.const] = logInfo.dispositions[f.const];
                } else if (contact.additionalInfo[f.const]?.[0]?.const) {
                    additionalFieldsValue[f.const] = contact.additionalInfo[f.const][0].const;
                }
                if (additionalFieldsValue[f.const] && !additionalFields[f.const].oneOf.some(af => af.const === additionalFieldsValue[f.const])) {
                    additionalFields[f.const].oneOf.push({ const: additionalFieldsValue[f.const], title: additionalFieldsValue[f.const] });
                }
                if (f.required) {
                    requiredFieldNames.push(f.const);
                }
                break;
            }
            case 'checkbox': {
                if (contact?.additionalInfo?.[f.const] === undefined) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'boolean',
                    associationField: !!f.contactDependent
                };
                additionalFieldsValue[f.const] = logInfo?.dispositions?.[f.const] ?? (f.defaultValue ?? false);
                if (f.required) {
                    requiredFieldNames.push(f.const);
                }
                break;
            }
            case 'inputField': {
                if (contact?.additionalInfo?.[f.const] ?? false) {
                    continue;
                }
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'string',
                    pattern: f.pattern,
                    associationField: !!f.contactDependent
                };
                additionalFieldsValue[f.const] = logInfo?.dispositions?.[f.const] ?? (f.defaultValue ?? '');
                if (f.required) {
                    requiredFieldNames.push(f.const);
                }
                break;
            }
            case 'warning': {
                additionalFields[f.const] = {
                    title: f.title,
                    type: 'string',
                    description: f.description
                };
                additionalWarningUISchemas[f.const] = {
                    "ui:field": "admonition",
                    "ui:severity": "warning",
                };
                break;
            }
        }
    }

    return { additionalFields, additionalFieldsValue, additionalWarningUISchemas, requiredFieldNames };
}

// Mirrors lines 187-211 of logPage.js
function buildContactWarningField(contactList, defaultContact) {
    if (contactList.length > 2) {
        const hasNewContact = contactList.some(c => c.isNewContact);
        const hasSearchContact = contactList.some(c => c.const === 'searchContact');
        if (contactList.length === 3 && hasNewContact && hasSearchContact) {
            return {};
        }
        return {
            warning: {
                type: 'string',
                description: t('pages.log.multipleContactsWarning'),
            }
        };
    }
    if (contactList.length === 1 && defaultContact.isNewContact) {
        return {
            warning: {
                type: 'string',
                description: t('pages.log.noContactWarning'),
            }
        };
    }
    return {};
}

// Mirrors lines 213-228 of logPage.js
function buildNewContactWidget(defaultContact, manifest, platformName) {
    const newContactWidget = {
        newContactName: { "ui:widget": "hidden" },
        newContactType: { "ui:widget": "hidden" }
    };
    if (defaultContact.isNewContact) {
        if (manifest.platforms[platformName].contactTypes?.length > 0) {
            newContactWidget.newContactType = {};
        }
        newContactWidget.newContactName = {
            "ui:placeholder": t('pages.log.enterName'),
        };
    }
    return newContactWidget;
}

// Builds the schema, uiSchema, and formData for a single contact section
// in a message createLog form. Used by groupLogPage.js for each group SMS correspondent.
function buildSingleContactSection({ contactInfo, manifest, platformName, logInfo, useContactSearch, id, contactPhoneNumber }) {
    const contactList = buildContactOptions(contactInfo, useContactSearch);
    const defaultContact = contactList.some(c => c.toNumberEntity)
        ? contactList.find(c => c.toNumberEntity)
        : (contactList[0] ?? null);

    let allAdditionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
    if (defaultContact.isNewContact) {
        allAdditionalFields = allAdditionalFields.concat(
            manifest.platforms[platformName].page?.newContact?.additionalFields ?? []
        );
    }

    const { additionalFields, additionalFieldsValue, additionalWarningUISchemas, requiredFieldNames } =
        buildAdditionalFieldsSchema({ allAdditionalFields, contact: defaultContact, logInfo });

    const warningField = buildContactWarningField(contactList, defaultContact);
    const newContactWidget = buildNewContactWidget(defaultContact, manifest, platformName);

    if (contactList.length === 1 && contactList.some(c => c.isNewContact)) {
        requiredFieldNames.push('newContactName');
    }

    const sectionSchema = {
        type: 'object',
        required: requiredFieldNames,
        properties: {
            ...warningField,
            id: { type: 'string' },
            contact: {
                title: t('common.labels.contact'),
                type: 'string',
                oneOf: contactList
            },
            newContactName: {
                title: t('pages.log.newContactName'),
                type: 'string',
            },
            contactType: { title: '', type: 'string' },
            contactName: { title: '', type: 'string' },
            triggerType: { title: '', type: 'string' },
            isUnresolved: { title: '', type: 'boolean' },
            logType: { title: '', type: 'string' },
            newContactType: {
                title: t('pages.log.contactType'),
                type: 'string',
                oneOf: manifest.platforms[platformName].contactTypes?.map(ct => ({ const: ct.value, title: ct.display })) ?? [],
            },
            ...additionalFields
        }
    };

    const sectionUISchema = {
        id: { "ui:widget": "hidden" },
        warning: {
            "ui:field": "admonition",
            "ui:severity": "warning",
        },
        contactType: { "ui:widget": "hidden" },
        contactName: { "ui:widget": "hidden" },
        triggerType: { "ui:widget": "hidden" },
        logType: { "ui:widget": "hidden" },
        isUnresolved: { "ui:widget": "hidden" },
        ...newContactWidget,
        ...additionalWarningUISchemas
    };

    const sectionFormData = {
        id,
        contact: defaultContact.const,
        newContactType: defaultContact.defaultContactType ?? '',
        newContactName: '',
        contactType: defaultContact?.type ?? '',
        contactName: defaultContact?.title ?? '',
        triggerType: 'createLog',
        logType: 'Message',
        contactPhoneNumber,
        isUnresolved: false,
        ...additionalFieldsValue
    };

    return { sectionSchema, sectionUISchema, sectionFormData };
}

exports.buildContactOptions = buildContactOptions;
exports.buildAdditionalFieldsSchema = buildAdditionalFieldsSchema;
exports.buildContactWarningField = buildContactWarningField;
exports.buildNewContactWidget = buildNewContactWidget;
exports.buildSingleContactSection = buildSingleContactSection;
