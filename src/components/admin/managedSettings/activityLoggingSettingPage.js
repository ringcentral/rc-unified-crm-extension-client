function getActivityLoggingSettingPageRender({ adminUserSettings }) {
    return {
        id: 'activityLoggingSettingPage',
        title: 'Activity logging',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                activityLoggingOptions: {
                    type: 'object',
                    title: 'Enable automatic activity logging for:',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'array',
                            title: 'Selected options',
                            items: {
                                type: 'string',
                                enum: [
                                    'oneTimeLog',
                                    'autoLogAnsweredIncoming',
                                    'autoLogMissedIncoming',
                                    'autoLogOutgoing',
                                    'autoLogVoicemails',
                                    'autoLogSMS',
                                    'autoLogInboundFax',
                                    'autoLogOutboundFax'

                                ],
                                enumNames: [
                                    'One-time call logging',
                                    'Answered incoming calls',
                                    'Missed incoming calls',
                                    'Outgoing calls',
                                    'Voicemails',
                                    'SMS',
                                    'Inbound faxes',
                                    'Outbound faxes'
                                ]
                            },
                            uniqueItems: true
                        }
                    }
                },
                logSyncFrequencySection: {
                    type: 'object',
                    title: 'Log sync frequency',
                    properties: {
                        logSyncFrequency: {
                            type: 'object',
                            title: 'Frequency',
                            properties: {
                                customizable: {
                                    type: 'boolean',
                                    title: 'Customizable by user'
                                },
                                value: {
                                    type: 'string',
                                    title: 'Value',
                                    enum: ['disabled', '10min', '30min', '1hour', '3hours', '1day'],
                                    enumNames: ['Disabled', '10 min', '30 min', '1 hour', '3 hours', '1 day']
                                }
                            }
                        }
                    }
                },
                autoOpenOptions: {
                    type: 'object',
                    title: 'Auto-open logging page after:',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'array',
                            title: 'Selected options',
                            items: {
                                type: 'string',
                                enum: [
                                    'popupLogPageAfterSMS',
                                    'popupLogPageAfterCall'
                                ]
                            },
                            uniqueItems: true
                        }
                    }
                }
            }
        },
        uiSchema: {
            activityLoggingOptions: {
                "ui:collapsible": true,
                value: {
                    "ui:widget": "checkboxes",
                    "ui:options": {
                        "inline": false
                    }
                }
            },
            logSyncFrequencySection: {
                "ui:collapsible": true,
            },
            autoOpenOptions: {
                "ui:collapsible": true,
                value: {
                    "ui:widget": "checkboxes",
                    "ui:options": {
                        "inline": false
                    }
                }
            },
            submitButtonOptions: {
                submitText: 'Save',
            },
        },
        formData: {
            activityLoggingOptions: {
                customizable: adminUserSettings?.autoLogAnsweredIncoming?.customizable ??
                    adminUserSettings?.autoLogMissedIncoming?.customizable ??
                    adminUserSettings?.autoLogOutgoing?.customizable ??
                    adminUserSettings?.autoLogVoicemails?.customizable ??
                    adminUserSettings?.autoLogSMS?.customizable ??
                    adminUserSettings?.autoLogInboundFax?.customizable ??
                    adminUserSettings?.autoLogOutboundFax?.customizable ??
                    adminUserSettings?.oneTimeLog?.customizable ?? true,
                value: [
                    ...((adminUserSettings?.autoLogAnsweredIncoming?.value ?? false) ? ['autoLogAnsweredIncoming'] : []),
                    ...((adminUserSettings?.autoLogMissedIncoming?.value ?? false) ? ['autoLogMissedIncoming'] : []),
                    ...((adminUserSettings?.autoLogOutgoing?.value ?? false) ? ['autoLogOutgoing'] : []),
                    ...((adminUserSettings?.autoLogVoicemails?.value ?? false) ? ['autoLogVoicemails'] : []),
                    ...((adminUserSettings?.autoLogSMS?.value ?? false) ? ['autoLogSMS'] : []),
                    ...((adminUserSettings?.autoLogInboundFax?.value ?? false) ? ['autoLogInboundFax'] : []),
                    ...((adminUserSettings?.autoLogOutboundFax?.value ?? false) ? ['autoLogOutboundFax'] : []),
                    ...((adminUserSettings?.oneTimeLog?.value ?? false) ? ['oneTimeLog'] : [])
                ]
            },
            logSyncFrequencySection: {
                logSyncFrequency: {
                    customizable: adminUserSettings?.logSyncFrequency?.customizable ?? true,
                    value: adminUserSettings?.logSyncFrequency?.value ?? '10min'
                }
            },
            autoOpenOptions: {
                customizable: adminUserSettings?.popupLogPageAfterSMS?.customizable ??
                    adminUserSettings?.popupLogPageAfterCall?.customizable ?? true,
                value: [
                    ...((adminUserSettings?.popupLogPageAfterSMS?.value ?? false) ? ['popupLogPageAfterSMS'] : []),
                    ...((adminUserSettings?.popupLogPageAfterCall?.value ?? false) ? ['popupLogPageAfterCall'] : [])
                ]
            }
        }
    }
}

exports.getActivityLoggingSettingPageRender = getActivityLoggingSettingPageRender;