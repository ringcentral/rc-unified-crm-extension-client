import { t } from '../i18n';
import { buildSingleContactSection } from './logPageUtils';

// Builds a group message log page with one collapsible section per correspondent.
// correspondentsData: [{ phoneNumber, displayName, contactInfo, logInfo? }]
function getGroupLogPageRender({ id, manifest, platformName, correspondentsData, useContactSearch }) {
    const schemaProperties = {};
    const uiSchemaProperties = {};
    const formDataProperties = {};

    correspondentsData.forEach((correspondent, index) => {
        const sectionKey = `section_${index}`;
        const { sectionSchema, sectionUISchema, sectionFormData } = buildSingleContactSection({
            contactInfo: correspondent.contactInfo,
            manifest,
            platformName,
            logInfo: correspondent.logInfo ?? null,
            useContactSearch,
            id,
            contactPhoneNumber: correspondent.phoneNumber
        });

        schemaProperties[sectionKey] = {
            ...sectionSchema,
            title: correspondent.displayName || correspondent.phoneNumber
        };

        uiSchemaProperties[sectionKey] = {
            "ui:collapsible": true,
            ...sectionUISchema
        };

        formDataProperties[sectionKey] = sectionFormData;
    });

    return {
        title: t('pages.log.saveTo', { platform: manifest.platforms[platformName].displayName }),
        schema: {
            type: 'object',
            required: [],
            properties: schemaProperties
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            },
            ...uiSchemaProperties
        },
        formData: formDataProperties
    };
}

// Handles form field changes within a single section.
// Expects updateData.keys[0] to be the section key (e.g., 'section_0')
// and updateData.keys[1] to be the changed field name within that section.
function getUpdatedGroupLogPageRender({ manifest, platformName, updateData }) {
    let page = updateData.page;
    page.formData = updateData.formData;

    const sectionKey = updateData.keys[0];
    const updatedFieldKey = updateData.keys.length > 1 ? updateData.keys[1] : null;

    if (!sectionKey || !page.schema.properties[sectionKey] || !updatedFieldKey) {
        return page;
    }

    const sectionSchema = page.schema.properties[sectionKey];
    const sectionUISchema = page.uiSchema[sectionKey] || {};
    const sectionFormData = page.formData[sectionKey] || {};

    const contact = sectionSchema.properties.contact.oneOf.find(c => c.const === sectionFormData.contact);

    switch (updatedFieldKey) {
        case 'contact': {
            if (!contact) break;

            if (contact.isNewContact) {
                if (manifest.platforms[platformName].contactTypes?.length > 0) {
                    sectionUISchema.newContactType = {};
                }
                sectionUISchema.newContactName = {
                    "ui:placeholder": t('pages.log.enterName'),
                };
                if (!sectionSchema.required.includes('newContactName')) {
                    sectionSchema.required.push('newContactName');
                }
                sectionFormData.newContactType = manifest.platforms[platformName].contactTypes?.length > 0
                    ? manifest.platforms[platformName].contactTypes[0].value
                    : '';
            } else {
                sectionFormData.newContactName = '';
                sectionFormData.newContactType = '';
                sectionUISchema.newContactType = { "ui:widget": "hidden" };
                sectionUISchema.newContactName = { "ui:widget": "hidden" };
                sectionSchema.required = [];
            }

            sectionFormData.contactType = contact.type;
            sectionFormData.contactName = contact.title;

            // Rebuild contact-dependent additional fields
            const allAssociationFields = Object.keys(sectionSchema.properties);
            for (const af of allAssociationFields) {
                if (sectionSchema.properties[af].associationField) {
                    delete sectionSchema.properties[af];
                    delete sectionFormData[af];
                }
            }

            let allAdditionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
            if (contact.isNewContact) {
                allAdditionalFields = allAdditionalFields.concat(
                    manifest.platforms[platformName].page?.newContact?.additionalFields ?? []
                );
            }

            for (const f of allAdditionalFields) {
                if (contact.ignoreAdditionalFields) {
                    continue;
                }
                switch (f.type) {
                    case 'selection': {
                        if (f.contactDependent && (contact?.additionalInfo?.[f.const] === undefined)) {
                            continue;
                        }
                        const baseOptions = [...contact.additionalInfo[f.const]];
                        const includeNoneOption = f.includeNoneOption !== false;
                        sectionSchema.properties[f.const] = {
                            title: f.title,
                            type: 'string',
                            oneOf: includeNoneOption ? [...baseOptions, { const: 'none', title: t('common.labels.none') }] : baseOptions,
                            associationField: f.contactDependent
                        };
                        sectionFormData[f.const] = f.contactDependent
                            ? contact.additionalInfo[f.const][0].const
                            : sectionFormData[f.const];
                        if (f.required) {
                            sectionSchema.required.push(f.const);
                        }
                        break;
                    }
                    case 'checkbox': {
                        if (f.contactDependent && (contact?.additionalInfo?.[f.const] === undefined)) {
                            continue;
                        }
                        sectionSchema.properties[f.const] = {
                            title: f.title,
                            type: 'boolean',
                            associationField: f.contactDependent
                        };
                        sectionFormData[f.const] = f.contactDependent ? f.defaultValue : sectionFormData[f.const];
                        if (f.required) {
                            sectionSchema.required.push(f.const);
                        }
                        break;
                    }
                    case 'inputField': {
                        if (f.contactDependent && (contact?.additionalInfo?.[f.const] ?? false)) {
                            continue;
                        }
                        sectionSchema.properties[f.const] = {
                            title: f.title,
                            type: 'string',
                            associationField: f.contactDependent
                        };
                        sectionFormData[f.const] = f.contactDependent ? f.defaultValue : sectionFormData[f.const];
                        if (f.required) {
                            sectionSchema.required.push(f.const);
                        }
                        break;
                    }
                    case 'warning': {
                        sectionSchema.properties[f.const] = {
                            title: f.title,
                            type: 'string',
                            description: f.description
                        };
                        sectionUISchema[f.const] = {
                            "ui:field": "admonition",
                            "ui:severity": "warning",
                        };
                        break;
                    }
                }
            }
            break;
        }
        case 'newContactType': {
            if (!contact) break;
            const contactTypeDependentFields = manifest.platforms[platformName].page?.newContact?.additionalFields?.filter(f => f.contactTypeDependent) ?? [];
            for (const f of contactTypeDependentFields) {
                sectionSchema.properties[f.const].oneOf = [
                    ...contact.additionalInfo[sectionFormData.newContactType][f.const],
                    { const: 'none', title: t('common.labels.none') }
                ];
            }
            break;
        }
    }

    // Pattern validation for the updated field
    if (sectionSchema.properties[updatedFieldKey]?.pattern) {
        const patternRegex = new RegExp(sectionSchema.properties[updatedFieldKey].pattern);
        const errorKey = `${updatedFieldKey}-error`;
        if (!sectionFormData[updatedFieldKey] || patternRegex.test(sectionFormData[updatedFieldKey])) {
            delete sectionSchema.properties[errorKey];
            delete sectionUISchema[errorKey];
        } else {
            sectionSchema.properties[errorKey] = {
                type: 'string',
                description: t('notifications.error.wrongFormat', { field: sectionSchema.properties[updatedFieldKey].title ?? updatedFieldKey })
            };
            sectionUISchema[errorKey] = {
                "ui:field": "admonition",
                "ui:severity": "error",
            };
        }
    }

    page.schema.properties[sectionKey] = sectionSchema;
    page.uiSchema[sectionKey] = sectionUISchema;
    page.formData[sectionKey] = sectionFormData;

    return page;
}

// Collects formData from all sections after the user clicks Save.
// Returns an array of per-correspondent submission objects matching the format
// expected by the messageLogger logForm handler in messageLogger/index.js.
function collectGroupLogFormData(formData, manifest, platformName) {
    const additionalFieldDefs = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
    const newContactAdditionalFieldDefs = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
    const allFieldDefs = additionalFieldDefs.concat(newContactAdditionalFieldDefs);

    return Object.keys(formData).map(sectionKey => {
        const sectionFormData = formData[sectionKey];
        const additionalSubmission = {};

        for (const f of allFieldDefs) {
            if (!f) {
                continue;
            }
            if (sectionFormData[f.const] !== undefined && sectionFormData[f.const] !== 'none') {
                additionalSubmission[f.const] = sectionFormData[f.const];
            }
        }

        return {
            contact: sectionFormData.contact,
            contactType: sectionFormData.newContactType !== '' ? sectionFormData.newContactType : sectionFormData.contactType,
            contactName: sectionFormData.newContactName !== '' ? sectionFormData.newContactName : sectionFormData.contactName,
            newContactName: sectionFormData.newContactName,
            newContactType: sectionFormData.newContactType,
            contactPhoneNumber: sectionFormData.contactPhoneNumber,
            additionalSubmission
        };
    });
}

exports.getGroupLogPageRender = getGroupLogPageRender;
exports.getUpdatedGroupLogPageRender = getUpdatedGroupLogPageRender;
exports.collectGroupLogFormData = collectGroupLogFormData;
