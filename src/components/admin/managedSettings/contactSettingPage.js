function getContactSettingPageRender({ adminUserSettings, renderOverridingNumberFormat }) {
    const page =
    {
        id: 'contactSettingPage',
        title: 'Contacts',
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
            openContactAfterCreatingIt:
            {
                customizable: adminUserSettings?.openContactAfterCreatingIt?.customizable ?? true,
                value: adminUserSettings?.openContactAfterCreatingIt?.value ?? false
            }
        }
    }
    if (renderOverridingNumberFormat) {
        page.schema.properties.overridingNumberFormat = {
            type: 'object',
            title: 'Overriding number format',
            properties: {
                warning: {
                    type: "string",
                    description: "Please input your overriding phone number format: (please use * to represent a number, eg. (***) ***-****)",
                },
                customizable: {
                    type: 'boolean',
                    title: 'Customizable by user'
                },
                numberFormatter1: {
                    type: 'string',
                    title: 'Format 1'
                },
                numberFormatter2: {
                    type: 'string',
                    title: 'Format 2'
                },
                numberFormatter3: {
                    type: 'string',
                    title: 'Format 3'
                }
            }
        }
        page.uiSchema.overridingNumberFormat = {
            "ui:collapsible": true,
        }
        page.uiSchema.overridingNumberFormat.warning = {
            "ui:field": "admonition",
            "ui:severity": "warning",  // "warning", "info", "error", "success"
        }
        page.formData.overridingNumberFormat = {
            customizable: adminUserSettings?.overridingNumberFormat?.customizable ?? true,
            numberFormatter1: adminUserSettings?.overridingNumberFormat?.numberFormatter1 ?? '',
            numberFormatter2: adminUserSettings?.overridingNumberFormat?.numberFormatter2 ?? '',
            numberFormatter3: adminUserSettings?.overridingNumberFormat?.numberFormatter3 ?? ''
        }
    }
    return page;
}
exports.getContactSettingPageRender = getContactSettingPageRender;