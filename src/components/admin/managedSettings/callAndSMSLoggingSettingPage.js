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
                autoLogInboundFax: {
                    type: 'object',
                    title: 'Log inbound faxes automatically',
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
                autoLogOutboundFax: {
                    type: 'object',
                    title: 'Log outbound faxes automatically',
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
                enableRetroCallLogSync: {
                    type: 'object',
                    title: 'Disable retroactive call log sync',
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
                oneTimeLog: {
                    type: 'object',
                    title: 'Enable one-time call logging',
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
                    title: '(Manual log) Open call logging page after call',
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
                    title: '(Manual log) Open SMS logging page after message',
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
                section: {
                    type: "string",
                    oneOf: [{
                        const: "callLogDetailsSetting",
                        title: "Call log details"
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
            popupLogPageAfterCall: {
                "ui:collapsible": true,
            },
            popupLogPageAfterSMS: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
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