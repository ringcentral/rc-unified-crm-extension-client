import userCore from '../core/user';
import logService from '../service/logService';
import { CONSTANTS } from '../misc/constant';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';

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
                const mappedOption = findMatchingFieldOption(
                    targetPage.schema.properties[defaultValue.field]?.oneOf,
                    defaultValue.value
                );
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
    if (typeof value1 === 'number' || typeof value2 === 'number') {
        return value1 === value2;
    }
    return String(value1).toLowerCase().replace(/\s/g, '') === String(value2).toLowerCase().replace(/\s/g, '');
}

function findMatchingFieldOption(options, value) {
    if (!Array.isArray(options) || value == null || String(value).trim() === '') {
        return null;
    }
    const matchedOption = options.find(o =>
        rawValueCompare(o.const, value) || (o.title != null && rawValueCompare(o.title, value))
    );
    return matchedOption?.const ?? null;
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
        conflictType = CONSTANTS.UNKNOWN_CONTACT_CONFLICT_TYPE;
    }
    else if (existingContactInfo.length > 1 && !defaultingContact) {
        hasConflict = true;
        return {
            hasConflict,
            autoSelectAdditionalSubmission,
            conflictType: CONSTANTS.MULTIPLE_CONTACTS_CONFLICT_TYPE
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
                    if (fieldDefaultValue && String(fieldDefaultValue.value ?? '').trim() !== '') {
                        const fieldMappedOption = findMatchingFieldOption(
                            defaultingContact.additionalInfo[key],
                            fieldDefaultValue.value
                        );
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
                                conflictType = CONSTANTS.DISPOSITION_CONFLICT_TYPE;
                            }
                        }
                    }
                    else {
                        allMatched = false;
                        conflictType = CONSTANTS.DISPOSITION_CONFLICT_TYPE;
                    }
                    return { hasConflict: false, autoSelectAdditionalSubmission, requireManualDisposition: !allMatched, conflictType };
                }
                else if (fieldOptions.length === 1) {
                    autoSelectAdditionalSubmission[key] = fieldOptions[0].const;
                }
            }
            // if non array field, go with the value directly
            else {
                const fieldDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ platform, userSettings, caseType, logType });
                const fieldDefaultValue = fieldDefaultValues.find(f => f.field === key);
                if (fieldDefaultValue) {
                    autoSelectAdditionalSubmission[key] = fieldDefaultValue.value;
                }
            }
        }
    }
    return { hasConflict, autoSelectAdditionalSubmission, conflictType }
}
async function addPendingRecordingSessionId({ sessionId }) {
    const { pendingRecordings } = await chrome.storage.local.get({ pendingRecordings: [] });
    if (!pendingRecordings.includes(sessionId)) {
        pendingRecordings.push(sessionId);
    }
    await chrome.storage.local.set({ pendingRecordings });
}

async function triggerPendingRecordingCheck({ serverUrl }) {
    let { pendingRecordings } = await chrome.storage.local.get({ pendingRecordings: [] });
    const removedPendingRecordings = [];
    if (pendingRecordings.length > 0) {
        for (const sessionId of pendingRecordings) {
            const callLog = await RCAdapter.getCallLog({ sessionId });
            if (callLog) {
                await logService.syncCallData({
                    serverUrl,
                    dataBody: callLog
                });
                removedPendingRecordings.push(sessionId);
            }
        }
        pendingRecordings = pendingRecordings.filter(sessionId => !removedPendingRecordings.includes(sessionId));
        await chrome.storage.local.set({ pendingRecordings });
    }
}

async function removePendingRecordingSessionId({ sessionId }) {
    let { pendingRecordings } = await chrome.storage.local.get({ pendingRecordings: [] });
    if (pendingRecordings.includes(sessionId)) {
        pendingRecordings = pendingRecordings.filter(sessionId => sessionId !== sessionId);
    }
    await chrome.storage.local.set({ pendingRecordings });
}

async function cacheLogPageData({ id, manifest, logType, triggerType, platformName, direction, contactInfo, logInfo, loggedContactId }) {
    if(!manifest)
    {
        // eslint-disable-next-line no-param-reassign
        manifest = await getManifest();
    }
    if(!platformName)
    {
        const platformInfo = await getPlatformInfo();
        // eslint-disable-next-line no-param-reassign
        platformName = platformInfo?.platformName ?? '';
    }
    const cacheLogPageData = {
        id,
        manifest,
        logType,
        triggerType,
        platformName,
        direction,
        contactInfo,
        logInfo,
        loggedContactId
    }
    await chrome.storage.local.set({ cacheLogPageData });
}

async function getCachedLogPageData() {
    const { cacheLogPageData } = await chrome.storage.local.get({ cacheLogPageData: null });
    return cacheLogPageData;
}

exports.getLogConflictInfo = getLogConflictInfo;
exports.logPageFormDataDefaulting = logPageFormDataDefaulting;
exports.addPendingRecordingSessionId = addPendingRecordingSessionId;
exports.triggerPendingRecordingCheck = triggerPendingRecordingCheck;
exports.removePendingRecordingSessionId = removePendingRecordingSessionId;
exports.cacheLogPageData = cacheLogPageData;
exports.getCachedLogPageData = getCachedLogPageData;