function getCallAndSMSLoggingSettingPageRender() {
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
                        autoLogCallCustomizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        autoLogCallValue: {
                            type: 'boolean',
                            title: 'Value (or default value)'
                        }
                    }
                },
                autoLogSMS: {
                    type: 'object',
                    title: 'Log SMS conversations automatically',
                    properties: {
                        autoLogSMSCustomizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        autoLogSMSValue: {
                            type: 'boolean',
                            title: 'Value (or default value)'
                        }
                    }
                },
                autoOpenCallLogPage: {
                    type: 'object',
                    title: 'Open call logging page after call',
                    properties: {
                        autoOpenCallLogPageCustomizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        autoOpenCallLogPageValue: {
                            type: 'boolean',
                            title: 'Value (or default value)'
                        }
                    }
                },
                autoOpenSMSLogPage: {
                    type: 'object',
                    title: 'Open SMS logging page after message',
                    properties: {
                        autoOpenSMSLogPageCustomizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        autoOpenSMSLogPageValue: {
                            type: 'boolean',
                            title: 'Value (or default value)'
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
            autoOpenCallLogPage: {
                "ui:collapsible": true,
            },
            autoOpenSMSLogPage: {
                "ui:collapsible": true,
            }
        }
    }
}

exports.getCallAndSMSLoggingSettingPageRender = getCallAndSMSLoggingSettingPageRender;