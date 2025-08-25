function getCustomizeTabsSettingPageRender({ adminUserSettings }) {
    return {
        id: 'customizeTabsSettingPage',
        title: 'Customize tabs',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                showChatTab: {
                    type: 'object',
                    title: 'Show chat tab',
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
                showMeetingsTab: {
                    type: 'object',
                    title: 'Show meetings tab',
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
                showTextTab: {
                    type: 'object',
                    title: 'Show text tab',
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
                showFaxTab: {
                    type: 'object',
                    title: 'Show fax tab',
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
                showVoicemailTab: {
                    type: 'object',
                    title: 'Show voicemail tab',
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
                showRecordingsTab: {
                    type: 'object',
                    title: 'Show recordings tab',
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
                showContactsTab: {
                    type: 'object',
                    title: 'Show contacts tab',
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
                showUserReportTab:{
                    type: 'object',
                    title: 'Show user report tab',
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
            showChatTab: {
                "ui:collapsible": true,
            },
            showMeetingsTab: {
                "ui:collapsible": true,
            },
            showTextTab: {
                "ui:collapsible": true,
            },
            showFaxTab: {
                "ui:collapsible": true,
            },
            showVoicemailTab: {
                "ui:collapsible": true,
            },
            showRecordingsTab: {
                "ui:collapsible": true,
            },
            showContactsTab: {
                "ui:collapsible": true,
            },  
            showUserReportTab: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            showChatTab:
            {
                customizable: adminUserSettings?.showChatTab?.customizable ?? true,
                value: adminUserSettings?.showChatTab?.value ?? true
            },
            showMeetingsTab:
            {
                customizable: adminUserSettings?.showMeetingsTab?.customizable ?? true,
                value: adminUserSettings?.showMeetingsTab?.value ?? true
            },
            showTextTab:
            {
                customizable: adminUserSettings?.showTextTab?.customizable ?? true,
                value: adminUserSettings?.showTextTab?.value ?? true
            },
            showFaxTab:
            {
                customizable: adminUserSettings?.showFaxTab?.customizable ?? true,
                value: adminUserSettings?.showFaxTab?.value ?? true
            },
            showVoicemailTab:
            {
                customizable: adminUserSettings?.showVoicemailTab?.customizable ?? true,
                value: adminUserSettings?.showVoicemailTab?.value ?? true
            },
            showRecordingsTab:
            {
                customizable: adminUserSettings?.showRecordingsTab?.customizable ?? true,
                value: adminUserSettings?.showRecordingsTab?.value ?? true
            },
            showContactsTab:
            {
                customizable: adminUserSettings?.showContactsTab?.customizable ?? true,
                value: adminUserSettings?.showContactsTab?.value ?? true
            },
            showUserReportTab:
            {
                customizable: adminUserSettings?.showUserReportTab?.customizable ?? true,
                value: adminUserSettings?.showUserReportTab?.value ?? true
            }
        }
    }
}

exports.getCustomizeTabsSettingPageRender = getCustomizeTabsSettingPageRender;