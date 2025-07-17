function getActivityLoggingSettingPageRender({ adminUserSettings }) {
    return {
        id: 'activityLoggingSettingPage',
        title: 'Activity logging',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                enableActivityLoggingSection: {
                    type: 'object',
                    title: 'Enable automatic activity logging for:',
                    description: 'Automatically log activities for the selected entities',
                    properties: {
                        autoLogAnsweredIncoming: {
                            type: 'object',
                            title: 'Answered incoming calls',
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
                        autoLogMissedIncoming: {
                            type: 'object',
                            title: 'Missed incoming calls',
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
                        autoLogOutgoing: {
                            type: 'object',
                            title: 'Outgoing calls',
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
                        autoLogVoicemails: {
                            type: 'object',
                            title: 'Voicemails',
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
                            title: 'SMS',
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
                            title: 'Inbound faxes',
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
                            title: 'Outbound faxes',
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
                preferencesSection: {
                    type: 'object',
                    title: 'Preferences',
                    description: 'Delays logging until full call details are available',
                    properties: {
                        oneTimeLog: {
                            type: 'object',
                            title: 'One-time call logging',
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
                logSyncFrequencySection: {
                    type: 'object',
                    title: 'Log sync frequency',
                    description: 'How often to sync missed activity; disable to turn off background logging',
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
                autoOpenSection: {
                    type: 'object',
                    title: 'Auto-open logging page after:',
                    description: 'Opens the logging page for manual entry after selected events',
                    properties: {
                        popupLogPageAfterSMS: {
                            type: 'object',
                            title: 'SMS is sent',
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
                            title: 'Call ends',
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
                }
            }
        },
        uiSchema: {
            enableActivityLoggingSection: {
                "ui:collapsible": true,
                autoLogAnsweredIncoming: {
                    "ui:collapsible": true,
                },
                autoLogMissedIncoming: {
                    "ui:collapsible": true,
                },
                autoLogOutgoing: {
                    "ui:collapsible": true,
                },
                autoLogVoicemails: {
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
                }
            },
            preferencesSection: {
                "ui:collapsible": true,
                oneTimeLog: {
                    "ui:collapsible": true,
                }
            },
            logSyncFrequencySection: {
                "ui:collapsible": true,
                logSyncFrequency: {
                    "ui:collapsible": true,
                }
            },
            autoOpenSection: {
                "ui:collapsible": true,
                popupLogPageAfterSMS: {
                    "ui:collapsible": true,
                },
                popupLogPageAfterCall: {
                    "ui:collapsible": true,
                }
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            enableActivityLoggingSection: {
                autoLogAnsweredIncoming: {
                    customizable: adminUserSettings?.autoLogAnsweredIncoming?.customizable ?? true,
                    value: adminUserSettings?.autoLogAnsweredIncoming?.value ?? false
                },
                autoLogMissedIncoming: {
                    customizable: adminUserSettings?.autoLogMissedIncoming?.customizable ?? true,
                    value: adminUserSettings?.autoLogMissedIncoming?.value ?? false
                },
                autoLogOutgoing: {
                    customizable: adminUserSettings?.autoLogOutgoing?.customizable ?? true,
                    value: adminUserSettings?.autoLogOutgoing?.value ?? false
                },
                autoLogVoicemails: {
                    customizable: adminUserSettings?.autoLogVoicemails?.customizable ?? true,
                    value: adminUserSettings?.autoLogVoicemails?.value ?? false
                },
                autoLogSMS: {
                    customizable: adminUserSettings?.autoLogSMS?.customizable ?? true,
                    value: adminUserSettings?.autoLogSMS?.value ?? false
                },
                autoLogInboundFax: {
                    customizable: adminUserSettings?.autoLogInboundFax?.customizable ?? true,
                    value: adminUserSettings?.autoLogInboundFax?.value ?? false
                },
                autoLogOutboundFax: {
                    customizable: adminUserSettings?.autoLogOutboundFax?.customizable ?? true,
                    value: adminUserSettings?.autoLogOutboundFax?.value ?? false
                }
            },
            preferencesSection: {
                oneTimeLog: {
                    customizable: adminUserSettings?.oneTimeLog?.customizable ?? true,
                    value: adminUserSettings?.oneTimeLog?.value ?? false
                }
            },
            logSyncFrequencySection: {
                logSyncFrequency: {
                    customizable: adminUserSettings?.logSyncFrequency?.customizable ?? true,
                    value: adminUserSettings?.logSyncFrequency?.value ?? '10min'
                }
            },
            autoOpenSection: {
                popupLogPageAfterSMS: {
                    customizable: adminUserSettings?.popupLogPageAfterSMS?.customizable ?? true,
                    value: adminUserSettings?.popupLogPageAfterSMS?.value ?? false
                },
                popupLogPageAfterCall: {
                    customizable: adminUserSettings?.popupLogPageAfterCall?.customizable ?? true,
                    value: adminUserSettings?.popupLogPageAfterCall?.value ?? false
                }
            }
        }
    }
}

exports.getActivityLoggingSettingPageRender = getActivityLoggingSettingPageRender;