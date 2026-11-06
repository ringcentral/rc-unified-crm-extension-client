import { t } from '../../i18n';

type UnknownRecord = Record<string, any>;

function numberListSchema(titleKey: string, descriptionKey: string): UnknownRecord {
    return {
        type: 'object',
        title: t(titleKey),
        description: t(descriptionKey),
        properties: {
            value: {
                type: 'array',
                title: t(titleKey),
                items: {
                    type: 'string',
                    default: ''
                }
            }
        }
    };
}

// The list title above already names the list, so the array and its rows render without labels.
const NUMBER_LIST_UI_SCHEMA: UnknownRecord = {
    "ui:collapsible": true,
    value: {
        "ui:options": {
            "orderable": false,
            "label": false
        },
        items: {
            "ui:options": {
                "label": false
            },
            "ui:placeholder": "+14155551234, 1234, +1415*"
        }
    }
};

function numberListFormData(setting: UnknownRecord | undefined): UnknownRecord {
    return { value: Array.isArray(setting?.value) ? setting.value : [] };
}

function getDoNotContactPageRender({ adminUserSettings }: UnknownRecord): UnknownRecord {
    return {
        id: 'doNotContactPage',
        title: t('doNotContact.pageTitle'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                doNotContactRestrictNumbers: numberListSchema('doNotContact.restrictListTitle', 'doNotContact.restrictListDescription'),
                doNotContactWarnNumbers: numberListSchema('doNotContact.warnListTitle', 'doNotContact.warnListDescription')
            }
        },
        uiSchema: {
            doNotContactRestrictNumbers: NUMBER_LIST_UI_SCHEMA,
            doNotContactWarnNumbers: NUMBER_LIST_UI_SCHEMA,
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            doNotContactRestrictNumbers: numberListFormData(adminUserSettings?.doNotContactRestrictNumbers),
            doNotContactWarnNumbers: numberListFormData(adminUserSettings?.doNotContactWarnNumbers)
        }
    }
}

export { getDoNotContactPageRender };
export default {
    getDoNotContactPageRender,
};
