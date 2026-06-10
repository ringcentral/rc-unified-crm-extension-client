import { t } from '../../../i18n';

function getAdvancedFeaturesSettingPageRender({ adminUserSettings }) {
    const page =
    {
        id: 'advancedFeaturesSettingPage',
        title: t('settings.advanced.groupName'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                autoOpenExtension: {
                    type: 'object',
                    title: t('settings.advanced.autoOpenExtension'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                developerMode: {
                    type: 'object',
                    title: t('settings.advanced.developerMode'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                popupLogPageAfterCall: {
                    type: 'object',
                    title: t('settings.logging.popupLogPageAfterCall'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                popupLogPageAfterSMS: {
                    type: 'object',
                    title: t('settings.logging.popupLogPageAfterSMS'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                }
            }
        },
        uiSchema: {
            autoOpenExtension: {
                "ui:collapsible": true,
            },
            developerMode: {
                "ui:collapsible": true,
            },
            popupLogPageAfterCall: {
                "ui:collapsible": true,
            },
            popupLogPageAfterSMS: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            },
        },
        formData: {
            autoOpenExtension:
            {
                customizable: adminUserSettings?.autoOpenExtension?.customizable ?? true,
                value: adminUserSettings?.autoOpenExtension?.value ?? false
            },
            developerMode:
            {
                customizable: adminUserSettings?.developerMode?.customizable ?? true,
                value: adminUserSettings?.developerMode?.value ?? false
            },
            popupLogPageAfterCall:
            {
                customizable: adminUserSettings?.popupLogPageAfterCall?.customizable ?? true,
                value: adminUserSettings?.popupLogPageAfterCall?.value ?? false
            },
            popupLogPageAfterSMS:
            {
                customizable: adminUserSettings?.popupLogPageAfterSMS?.customizable ?? true,
                value: adminUserSettings?.popupLogPageAfterSMS?.value ?? false
            }
        }
    }
    return page;
}
exports.getAdvancedFeaturesSettingPageRender = getAdvancedFeaturesSettingPageRender;
