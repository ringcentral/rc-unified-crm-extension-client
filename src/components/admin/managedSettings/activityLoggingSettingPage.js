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
                customizable: adminUserSettings?.autoLogAnsweredIncoming?.customizable ??
                    adminUserSettings?.autoLogMissedIncoming?.customizable ??
                    adminUserSettings?.autoLogOutgoing?.customizable ??
                    adminUserSettings?.autoLogVoicemails?.customizable ??
                    adminUserSettings?.autoLogSMS?.customizable ??
                    adminUserSettings?.autoLogInboundFax?.customizable ??
                    adminUserSettings?.autoLogOutboundFax?.customizable ?? true,
                value: [
                    ...((adminUserSettings?.autoLogAnsweredIncoming?.value ?? false) ? ['autoLogAnsweredIncoming'] : []),
                    ...((adminUserSettings?.autoLogMissedIncoming?.value ?? false) ? ['autoLogMissedIncoming'] : []),
                    ...((adminUserSettings?.autoLogOutgoing?.value ?? false) ? ['autoLogOutgoing'] : []),
                    ...((adminUserSettings?.autoLogVoicemails?.value ?? false) ? ['autoLogVoicemails'] : []),
                    ...((adminUserSettings?.autoLogSMS?.value ?? false) ? ['autoLogSMS'] : []),
                    ...((adminUserSettings?.autoLogInboundFax?.value ?? false) ? ['autoLogInboundFax'] : []),
                    ...((adminUserSettings?.autoLogOutboundFax?.value ?? false) ? ['autoLogOutboundFax'] : [])
                ]
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
                customizable: adminUserSettings?.popupLogPageAfterSMS?.customizable ??
                    adminUserSettings?.popupLogPageAfterCall?.customizable ?? true,
                value: [
                    ...((adminUserSettings?.popupLogPageAfterSMS?.value ?? false) ? ['popupLogPageAfterSMS'] : []),
                    ...((adminUserSettings?.popupLogPageAfterCall?.value ?? false) ? ['popupLogPageAfterCall'] : [])
                ]
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

                        // Determine current value based on individual setting values
                        const currentSelectedOptions = [];
                        let isCustomizable = true;

                        for (const option of filteredOptions) {
                            if (adminUserSettings?.[option.id]?.value) {
                                currentSelectedOptions.push(option.id);
                            }
                            // If any individual option is not customizable, the whole section becomes non-customizable
                            if (adminUserSettings?.[option.id]?.customizable === false) {
                                isCustomizable = false;
                            }
                        }

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