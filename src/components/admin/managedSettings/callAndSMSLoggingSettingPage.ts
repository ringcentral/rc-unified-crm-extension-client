import { t } from '../../../i18n';

type UnknownRecord = Record<string, any>;

function getCallAndSMSLoggingSettingPageRender({ adminUserSettings }: UnknownRecord): UnknownRecord {
    return {
        id: 'callAndSMSLoggingSettingPage',
        title: t('settings.logging.groupName'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                autoLogCall: {
                    type: 'object',
                    title: t('settings.logging.autoLogCall'),
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
                autoLogSMS: {
                    type: 'object',
                    title: t('settings.logging.autoLogSMS'),
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
                autoLogVoicemail: {
                    type: 'object',
                    title: t('settings.logging.autoLogVoicemail'),
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
                autoLogInboundFax: {
                    type: 'object',
                    title: t('settings.logging.autoLogInboundFax'),
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
                autoLogOutboundFax: {
                    type: 'object',
                    title: t('settings.logging.autoLogOutboundFax'),
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
                enableRetroCallLogSync: {
                    type: 'object',
                    title: t('settings.logging.disableRetroCallLogSync'),
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
                oneTimeLog: {
                    type: 'object',
                    title: t('settings.logging.enableOneTimeLog'),
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
                section: {
                    type: "string",
                    oneOf: [{
                        const: "callLogDetailsSetting",
                        title: t('settings.callLogDetails.groupName')
                    }, {
                        const: "autoLogPreferences",
                        title: t('settings.autoLogPreferences.groupName')
                    }]
                }
            }
        },
        uiSchema: {
            section: {
                "ui:field": "list",
                "ui:navigation": true,
            },
            autoLogCall: {
                "ui:collapsible": true,
            },
            autoLogSMS: {
                "ui:collapsible": true,
            },
            autoLogVoicemail: {
                "ui:collapsible": true,
            },
            autoLogInboundFax: {
                "ui:collapsible": true,
            },
            autoLogOutboundFax: {
                "ui:collapsible": true,
            },
            enableRetroCallLogSync: {
                "ui:collapsible": true,
            },
            oneTimeLog: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
            }
        },
        formData: {
            autoLogCall:
            {
                customizable: adminUserSettings?.autoLogCall?.customizable ?? true,
                value: adminUserSettings?.autoLogCall?.value ?? false
            },
            autoLogSMS:
            {
                customizable: adminUserSettings?.autoLogSMS?.customizable ?? true,
                value: adminUserSettings?.autoLogSMS?.value ?? false
            },
            autoLogVoicemail:
            {
                customizable: adminUserSettings?.autoLogVoicemail?.customizable ?? true,
                value: adminUserSettings?.autoLogVoicemail?.value ?? false
            },
            autoLogInboundFax:
            {
                customizable: adminUserSettings?.autoLogInboundFax?.customizable ?? true,
                value: adminUserSettings?.autoLogInboundFax?.value ?? false
            },
            autoLogOutboundFax:
            {
                customizable: adminUserSettings?.autoLogOutboundFax?.customizable ?? true,
                value: adminUserSettings?.autoLogOutboundFax?.value ?? false
            },
            enableRetroCallLogSync:
            {
                customizable: adminUserSettings?.enableRetroCallLogSync?.customizable ?? true,
                value: adminUserSettings?.enableRetroCallLogSync?.value ?? true
            },
            oneTimeLog:
            {
                customizable: adminUserSettings?.oneTimeLog?.customizable ?? true,
                value: adminUserSettings?.oneTimeLog?.value ?? false
            }
        }
    }
}

export { getCallAndSMSLoggingSettingPageRender };
export default {
    getCallAndSMSLoggingSettingPageRender,
};
