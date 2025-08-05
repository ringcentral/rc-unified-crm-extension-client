function getActivityLoggingSettingPageRender({ adminUserSettings, crmManifest, userPermissions = {} }) {
    const page = {
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
                                    'autoLogAnsweredIncoming',
                                    'autoLogMissedIncoming',
                                    'autoLogOutgoing',
                                    'autoLogVoicemails',
                                    'autoLogSMS',
                                    'autoLogInboundFax',
                                    'autoLogOutboundFax'

                                ],
                                enumNames: [
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
                    title: 'Call Log Sync Frequency',
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
                            title: 'Enable one-time call logging functionality'
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
                                ],
                                enumNames: [
                                    'SMS is sent',
                                    'Call ends'
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
            oneTimeLog: {
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
                customizable: adminUserSettings?.activityLoggingOptions?.customizable ?? true,
                value: adminUserSettings?.activityLoggingOptions?.value ?? []
            },
            logSyncFrequencySection: {
                logSyncFrequency: {
                    customizable: adminUserSettings?.logSyncFrequency?.customizable ?? true,
                    value: adminUserSettings?.logSyncFrequency?.value ?? '10min'
                }
            },
            oneTimeLog: {
                customizable: adminUserSettings?.oneTimeLog?.customizable ?? true,
                value: adminUserSettings?.oneTimeLog?.value ?? false
            },
            autoOpenOptions: {
                customizable: adminUserSettings?.autoOpenOptions?.customizable ?? true,
                value: adminUserSettings?.autoOpenOptions?.value ?? []
            }
        }
    };

    // Add custom settings with section "activityLogging"
    if (crmManifest?.settings) {
        for (const customSetting of crmManifest.settings) {
            if (customSetting.section === 'activityLogging') {

                // Handle different types of custom settings
                switch (customSetting.type) {
                    case 'option':
                        // Filter options based on permissions
                        const filteredOptions = customSetting.options ? customSetting.options.filter(opt =>
                            !opt.requiredPermission || userPermissions[opt.requiredPermission]
                        ) : [];

                        page.schema.properties[customSetting.id] = {
                            type: 'object',
                            title: customSetting.name,
                            properties: {
                                customizable: {
                                    type: 'boolean',
                                    title: 'Customizable by user'
                                },
                                value: {
                                    type: 'array',
                                    title: customSetting.name,
                                    items: {
                                        type: 'string',
                                        enum: filteredOptions.map(opt => opt.id),
                                        enumNames: filteredOptions.map(opt => opt.name)
                                    },
                                    uniqueItems: true
                                }
                            }
                        };

                        page.uiSchema[customSetting.id] = {
                            "ui:collapsible": true,
                            value: {
                                "ui:widget": "checkboxes",
                                "ui:options": {
                                    "inline": false
                                }
                            }
                        };

                        // Get current value from array-based setting
                        const currentSelectedOptions = adminUserSettings?.[customSetting.id]?.value ?? [];
                        let isCustomizable = adminUserSettings?.[customSetting.id]?.customizable ?? true;

                        page.formData[customSetting.id] = {
                            customizable: isCustomizable,
                            value: currentSelectedOptions
                        };
                        break;

                    case 'boolean':
                        page.schema.properties[customSetting.id] = {
                            type: 'object',
                            title: customSetting.name,
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
                        };

                        page.uiSchema[customSetting.id] = {
                            "ui:collapsible": true
                        };

                        page.formData[customSetting.id] = {
                            customizable: adminUserSettings?.[customSetting.id]?.customizable ?? true,
                            value: adminUserSettings?.[customSetting.id]?.value ?? customSetting.defaultValue ?? false
                        };
                        break;
                }
            }
        }
    }

    return page;
}

exports.getActivityLoggingSettingPageRender = getActivityLoggingSettingPageRender;