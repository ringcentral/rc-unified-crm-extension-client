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
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Enable mode',
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
                    title: 'URLs',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'array',
                            title: 'URL',
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
            }
        }
    }
}

exports.getClickToDialEmbedPageRender = getClickToDialEmbedPageRender;