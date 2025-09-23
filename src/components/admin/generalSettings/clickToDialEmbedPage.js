function getClickToDialEmbedPageRender({ adminUserSettings }) {
    return {
        id: 'clickToDialEmbedPage',
        title: 'Enabled domains',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                clickToDialEmbedMode: {
                    type: 'object',
                    title: 'Click-to-dial enable mode',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Click-to-dial enable mode',
                            oneOf: [
                                { const: 'disabled', title: 'Disabled' },
                                { const: 'crmOnly', title: 'Enable for connected CRM only' },
                                { const: 'whitelist', title: 'Block by default (then manage a list of sites to allow)' },
                                { const: 'blacklist', title: 'Allow by default (then manage a list of sites to block)' },
                            ],
                            default: 'crmOnly'
                        }
                    }
                },
                clickToDialUrls: {
                    type: 'object',
                    title: 'Click-to-dial URLs',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'array',
                            title: 'Click-to-dial URLs',
                            items: {
                                type: 'string',
                                default: ''
                            }
                        }
                    }
                },
                quickAccessButtonEmbedMode: {
                    type: 'object',
                    title: 'Quick access button enable mode',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Quick access button enable mode',
                            oneOf: [
                                { const: 'disabled', title: 'Disabled' },
                                { const: 'crmOnly', title: 'Enable for connected CRM only' },
                                { const: 'whitelist', title: 'Block by default (then manage a list of sites to allow)' },
                                { const: 'blacklist', title: 'Allow by default (then manage a list of sites to block)' },
                            ],
                            default: 'crmOnly'
                        }
                    }
                },
                quickAccessButtonUrls: {
                    type: 'object',
                    title: 'Quick access button URLs',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'array',
                            title: 'Quick access button URLs',
                            items: {
                                type: 'string',
                                default: ''
                            }
                        }
                    }
                }
            }
        },
        uiSchema: {
            clickToDialEmbedMode: {
                "ui:collapsible": true
            },
            clickToDialUrls: {
                "ui:collapsible": true,
                value: {
                    "ui:options": {
                        "orderable": false
                    }
                }
            },
            quickAccessButtonEmbedMode: {
                "ui:collapsible": true
            },
            quickAccessButtonUrls: {
                "ui:collapsible": true,
                value: {
                    "ui:options": {
                        "orderable": false
                    }
                }
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            clickToDialEmbedMode: {
                customizable: adminUserSettings?.clickToDialEmbedMode?.customizable ?? true,
                value: adminUserSettings?.clickToDialEmbedMode?.value ?? 'crmOnly'
            },
            clickToDialUrls: {
                customizable: adminUserSettings?.clickToDialUrls?.customizable ?? true,
                value: adminUserSettings?.clickToDialUrls?.value ?? ''
            },
            quickAccessButtonEmbedMode: {
                customizable: adminUserSettings?.quickAccessButtonEmbedMode?.customizable ?? true,
                value: adminUserSettings?.quickAccessButtonEmbedMode?.value ?? 'crmOnly'
            },
            quickAccessButtonUrls: {
                customizable: adminUserSettings?.quickAccessButtonUrls?.customizable ?? true,
                value: adminUserSettings?.quickAccessButtonUrls?.value ?? ''
            }
        }
    }
}

exports.getClickToDialEmbedPageRender = getClickToDialEmbedPageRender;