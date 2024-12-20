function getCallAndSMSLoggingSettingPageRender({ adminUserSettings }) {
    return {
        id: 'callAndSMSLoggingSettingPage',
        title: 'Call and SMS logging',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                autoLogCall: {
                    type: 'object',
                    title: 'Log phone calls automatically',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                autoLogSMS: {
                    type: 'object',
                    title: 'Log SMS conversations automatically',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                popupLogPageAfterCall: {
                    type: 'object',
                    title: 'Open call logging page after call',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                popupLogPageAfterSMS: {
                    type: 'object',
                    title: 'Open SMS logging page after message',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                }
            }
        },
        uiSchema: {
            autoLogCall: {
                "ui:collapsible": true,
            },
            autoLogSMS: {
                "ui:collapsible": true,
            },
            popupLogPageAfterCall: {
                "ui:collapsible": true,
            },
            popupLogPageAfterSMS: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            },
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
}

exports.getCallAndSMSLoggingSettingPageRender = getCallAndSMSLoggingSettingPageRender;