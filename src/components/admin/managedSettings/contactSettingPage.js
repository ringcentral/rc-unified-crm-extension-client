function getContactSettingPageRender({ adminUserSettings, renderOverridingNumberFormat, renderAllowExtensionNumberLogging }) {
    const page =
    {
        id: 'contactSettingPage',
        title: 'Call-pop',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                openContactPageFromIncomingCall: {
                    type: 'object',
                    title: 'Open contact from incoming call',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            name: 'Open contact from incoming call',
                            oneOf: [
                                {
                                    const: 'disabled',
                                    title: 'Disabled'
                                },
                                {
                                    const: 'onFirstRing',
                                    title: 'On first ring'
                                },
                                {
                                    const: 'onAnswer',
                                    title: 'On answer'
                                }
                            ]
                        }
                    }
                },
                openContactPageFromOutgoingCall: {
                    type: 'object',
                    title: 'Open contact from outgoing call',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            name: 'Open contact from outgoing call',
                            oneOf: [
                                {
                                    const: 'disabled',
                                    title: 'Disabled'
                                },
                                {
                                    const: 'onFirstRing',
                                    title: 'On first ring'
                                },
                                {
                                    const: 'onAnswer',
                                    title: 'On answer'
                                }
                            ]
                        }
                    }
                },
                multiContactMatchBehavior: {
                    type: 'object',
                    title: 'Multi-contact match behavior',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            name: 'OMulti-contact match behavior',
                            oneOf: [
                                {
                                    const: 'disabled',
                                    title: 'Disabled'
                                },
                                {
                                    const: 'openAllMatches',
                                    title: 'Open all matches'
                                },
                                {
                                    const: 'promptToSelect',
                                    title: 'Prompt to select'
                                }
                            ]
                        }
                    }
                },
                openContactAfterCreatingIt: {
                    type: 'object',
                    title: 'Open contact after creating it',
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
            openContactPageFromIncomingCall: {
                "ui:collapsible": true,
            },
            openContactPageFromOutgoingCall: {
                "ui:collapsible": true,
            },
            multiContactMatchBehavior: {
                "ui:collapsible": true,
            },
            openContactAfterCreatingIt: {
                "ui:collapsible": true,
            },
            contactSettingPageSubmitButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            },
            submitButtonOptions: {
                submitText: 'Save',
            },
        },
        formData: {
            openContactPageFromIncomingCall:
            {
                customizable: adminUserSettings?.openContactPageFromIncomingCall?.customizable ?? true,
                value: adminUserSettings?.openContactPageFromIncomingCall?.value ?? 'disabled'
            },
            openContactPageFromOutgoingCall:
            {
                customizable: adminUserSettings?.openContactPageFromOutgoingCall?.customizable ?? true,
                value: adminUserSettings?.openContactPageFromOutgoingCall?.value ?? 'disabled'
            },
            multiContactMatchBehavior:
            {
                customizable: adminUserSettings?.multiContactMatchBehavior?.customizable ?? true,
                value: adminUserSettings?.multiContactMatchBehavior?.value ?? 'promptToSelect'
            },
            openContactAfterCreatingIt:
            {
                customizable: adminUserSettings?.openContactAfterCreatingIt?.customizable ?? true,
                value: adminUserSettings?.openContactAfterCreatingIt?.value ?? false
            }
        }
    }
    // Overriding number format moved to Managed settings -> Custom settings
    if(renderAllowExtensionNumberLogging)
    {
        page.schema.properties.allowExtensionNumberLogging = {
            type: 'object',
            title: 'Allow extension number logging',
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
        page.uiSchema.allowExtensionNumberLogging = {
            "ui:collapsible": true,
        }
        page.formData.allowExtensionNumberLogging = {
            customizable: adminUserSettings?.allowExtensionNumberLogging?.customizable ?? true,
            value: adminUserSettings?.allowExtensionNumberLogging?.value ?? false
        }
    }
    return page;
}
exports.getContactSettingPageRender = getContactSettingPageRender;