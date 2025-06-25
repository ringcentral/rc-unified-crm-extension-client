import userCore from '../core/user';
function getAdditionalFieldDefaultValuesFromSetting({
    platform,
    userSettings,
    caseType,
    logType
}) {
    const additionalFields = platform?.page[logType]?.additionalFields;
    const result = [];
    if (!!additionalFields && !!platform.settings && platform.settings.length > 0) {
        for (const field of additionalFields) {
            let defaultValueSetting = null;
            for (const setting of platform.settings) {
                if (setting.id === field.defaultSettingId) {
                    defaultValueSetting = setting;
                    break;
                }
            }
            if (defaultValueSetting) {
                const valueItem = defaultValueSetting.items.find(i => i.id === field.defaultSettingValues[caseType].settingId)
                if (valueItem) {
                    result.push({ field: field.const, value: userCore.getCustomSetting(userSettings, valueItem.id, valueItem.defaultValue).value });
                }
            }
        }
    }
    return result;
}

async function logPageFormDataDefaulting({ platform, targetPage, caseType, logType }) {
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    const platformName = platform.name;
    const defaultValues = getAdditionalFieldDefaultValuesFromSetting({
        platform,
        userSettings,
        caseType,
        logType
    });
    let updatedTargetPage = targetPage;
    for (const defaultValue of defaultValues) {
        let fieldType = targetPage.schema.properties[defaultValue.field]?.oneOf ? 'options' : 'boolean';
        switch (fieldType) {
            case 'options':
                const mappedOption = targetPage.schema.properties[defaultValue.field]?.oneOf.find(o => rawValueCompare(o.const, defaultValue.value))?.const;
                if (mappedOption) {
                    updatedTargetPage.formData[defaultValue.field] = mappedOption;
                }
                else if (allowBullhornCustomNoteAction({ platformName, userSettings }) && !!platform?.page['callLog']?.additionalFields.find(f => f.const == defaultValue.field)?.allowCustomValue && !!targetPage.schema.properties[defaultValue.field]?.oneOf) {
                    targetPage.schema.properties[defaultValue.field].oneOf.push({ const: defaultValue.value, title: defaultValue.value });
                    updatedTargetPage.formData[defaultValue.field] = defaultValue.value;
                }
                break;
            case 'boolean':
                if (defaultValue?.value) {
                    updatedTargetPage.formData[defaultValue.field] = defaultValue.value;
                }
                break;
        }
    }
    return updatedTargetPage;
}

// Hack: bullhorn specific logic to check if allow custom note action value
function allowBullhornCustomNoteAction({ platformName, userSettings }) {
    if (platformName === 'bullhorn') {
        const allowedFromUserSetting = userSettings?.allowBullhornCustomNoteAction?.value ?? false;
        return allowedFromUserSetting;
    }
    else {
        return true;
    }
}

// A fuzzy string compare that ignores cases and spaces
function rawValueCompare(value1 = '', value2 = '') {
    // check if value1 is a number
    if (!Number.isNaN(value1)) {
        return value1 === value2;
    }
    else {
        return value1.toLowerCase().replace(/\s/g, '') === value2.toLowerCase().replace(/\s/g, '');
    }
}

async function getLogConflictInfo({
    platform,
    isAutoLog,
    contactInfo,
    logType,
    direction,
    isVoicemail,
    isFax
}) {
    let conflictType = 'No conflict';
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    if (!isAutoLog) {
        return { hasConflict: false, autoSelectAdditionalSubmission: {}, conflictType }
    }
    let hasConflict = false;
    let autoSelectAdditionalSubmission = {};
    const existingContactInfo = contactInfo.filter(c => !c.isNewContact);
    let defaultingContact = existingContactInfo.find(c => c.toNumberEntity);
    if (existingContactInfo.length === 0) {
        hasConflict = true;
        conflictType = 'Unknown contact';
    }
    else if (existingContactInfo.length > 1 && !defaultingContact) {
        hasConflict = true;
        return {
            hasConflict,
            autoSelectAdditionalSubmission,
            conflictType: 'Multiple contacts'
        }
    }

    if (!defaultingContact) {
        defaultingContact = existingContactInfo[0];
    }
    if (defaultingContact?.additionalInfo) {
        const additionalFieldsKeys = Object.keys(defaultingContact.additionalInfo);
        // go through all additional fields
        for (const key of additionalFieldsKeys) {
            const fieldOptions = defaultingContact.additionalInfo[key];
            let caseType = '';
            if (logType === 'callLog') {
                if (direction === 'Inbound') {
                    caseType = 'inboundCall';
                }
                else {
                    caseType = 'outboundCall';
                }
            }
            else if (logType === 'messageLog') {
                if (isVoicemail) {
                    caseType = 'voicemail';
                }
                else if (isFax) {
                    caseType = 'fax';
                }
                else {
                    caseType = 'message';
                }
            }
            // check if this contact's field options exist and
            // 1. Only 1 option -> directly choose it
            // 2. More than 1 option -> Check default value setup
            //    2.1 If no default value -> Report conflict
            //    2.2 If default value -> Apply it
            // 3. zero option ->  
            if (Array.isArray(fieldOptions)) {
                if (fieldOptions.length > 1) {
                    const fieldDefaultValues = getAdditionalFieldDefaultValuesFromSetting({
                        platform,
                        userSettings,
                        caseType,
                        logType
                    });
                    let allMatched = true;
                    const fieldDefaultValue = fieldDefaultValues.find(f => f.field === key);
                    if (fieldDefaultValue) {
                        const fieldMappedOption = defaultingContact.additionalInfo[key]?.find(o => rawValueCompare(o.const, fieldDefaultValue.value))?.const;
                        if (fieldMappedOption) {
                            autoSelectAdditionalSubmission[key] = fieldMappedOption;
                            continue;
                        }
                        else {
                            const allowCustomValue = !!platform?.page[logType]?.additionalFields.find(f => f.const == key)?.allowCustomValue;
                            if (allowBullhornCustomNoteAction({ platformName: platform.name, userSettings }) && allowCustomValue) {
                                autoSelectAdditionalSubmission[key] = fieldDefaultValue.value;
                                continue;
                            }
                            else {
                                allMatched = false;
                                conflictType = 'Disposition conflict';
                            }
                        }
                    }
                    else {
                        allMatched = false;
                        conflictType = 'Disposition conflict';
                    }
                    return { hasConflict: false, autoSelectAdditionalSubmission, requireManualDisposition: !allMatched, conflictType };
                }
                else if (fieldOptions.length === 1) {
                    autoSelectAdditionalSubmission[key] = fieldOptions[0].const;
                }
            }
            // if non array field, go with the value directly
            else {
                const fieldDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType, logType });
                const fieldDefaultValue = fieldDefaultValues.find(f => f.field === key);
                if (fieldDefaultValue) {
                    autoSelectAdditionalSubmission[key] = fieldDefaultValue.value;
                }
            }
        }
    }
    return { hasConflict, autoSelectAdditionalSubmission, conflictType }
}

exports.getLogConflictInfo = getLogConflictInfo;
exports.logPageFormDataDefaulting = logPageFormDataDefaulting;