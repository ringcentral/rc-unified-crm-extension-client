import { t } from '../../../../i18n';

function getAutoLogPreferenceSettingPageRender({ adminUserSettings, contactTypes }) {
    const newContactTypes = contactTypes.map(contactType => ({
        const: contactType.value,
        title: contactType.display
    }));
    const page = {
        id: 'autoLogPreferenceSettingPage',
        title: t('settings.autoLogPreferences.groupName'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                unknownContactPreference: {
                    type: 'object',
                    title: t('settings.autoLogPreferences.unknownContact'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('common.labels.value'),
                            oneOf: [
                                {
                                    const: 'skipLogging',
                                    title: t('settings.autoLogPreferences.skipLogging')
                                },
                                {
                                    const: 'createNewPlaceholderContact',
                                    title: t('settings.autoLogPreferences.createNewPlaceholder')
                                }
                            ]
                        }
                    }
                },
                newContactType: {
                    type: 'object',
                    title: t('settings.autoLogPreferences.newContactType'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('common.labels.value'),
                            oneOf: newContactTypes
                        }
                    }
                },
                newContactNamePrefix: {
                    type: 'object',
                    title: t('settings.autoLogPreferences.newContactNamePrefix'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('common.labels.value')
                        }
                    }
                },
                multipleContactsPreference: {
                    type: 'object',
                    title: t('settings.autoLogPreferences.multipleContacts'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('common.labels.value'),
                            oneOf: [
                                {
                                    const: 'skipLogging',
                                    title: t('settings.autoLogPreferences.skipLogging')
                                },
                                {
                                    const: 'firstAlphabetical',
                                    title: t('settings.autoLogPreferences.firstAlphabetical')
                                },
                                {
                                    const: 'mostRecentActivity',
                                    title: t('settings.autoLogPreferences.mostRecentActivity')
                                }
                            ]
                        }
                    }
                }
            }
        },
        uiSchema: {
            unknownContactPreference: {
                "ui:collapsible": true,
            },
            newContactType: {
                "ui:collapsible": true,
            },
            multipleContactsPreference: {
                "ui:collapsible": true,
            },
            newContactNamePrefix: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            }
        },
        formData: {
            unknownContactPreference: {
                customizable: adminUserSettings?.unknownContactPreference?.customizable ?? true,
                value: adminUserSettings?.unknownContactPreference?.value ?? 'skipLogging'
            },
            newContactType: {
                customizable: adminUserSettings?.newContactType?.customizable ?? true,
                value: adminUserSettings?.newContactType?.value ?? contactTypes[0]
            },
            multipleContactsPreference: {
                customizable: adminUserSettings?.multipleContactsPreference?.customizable ?? true,
                value: adminUserSettings?.multipleContactsPreference?.value ?? 'skipLogging'
            },
            newContactNamePrefix: {
                customizable: adminUserSettings?.newContactNamePrefix?.customizable ?? true,
                value: adminUserSettings?.newContactNamePrefix?.value ?? 'PlaceholderContact'
            }
        }
    }
    return page;
}

exports.getAutoLogPreferenceSettingPageRender = getAutoLogPreferenceSettingPageRender;
