import { t } from '../../i18n';

type UnknownRecord = Record<string, any>;

function numberListSchema(titleKey: string, descriptionKey: string): UnknownRecord {
    return {
        type: 'object',
        title: t(titleKey),
        description: `${t(descriptionKey)} ${t('doNotContact.formatHelp')}`,
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
            doNotContactRestrictNumbers: {
                "ui:collapsible": true,
                value: {
                    "ui:options": {
                        "orderable": false
                    }
                }
            },
            doNotContactWarnNumbers: {
                "ui:collapsible": true,
                value: {
                    "ui:options": {
                        "orderable": false
                    }
                }
            },
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
