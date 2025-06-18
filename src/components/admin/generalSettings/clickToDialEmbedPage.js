function getClickToDialEmbedPageRender({ adminUserSettings }) {
    return {
        id: 'clickToDialEmbedPage',
        title: 'Click-to-dial',
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
                            title: 'Click-to-dial mode',
                            oneOf: [
                                { const: 'disabled', title: 'Disabled' },
                                { const: 'crmOnly', title: 'Enable for connected CRM only' },
                                { const: 'whitelist', title: 'Allow by default (then manage a list of sites to block)' },
                                { const: 'blacklist', title: 'Block by default (then manage a list of sites to allow)' },
                            ],
                            default: 'crmOnly'
                        }
                    }
                },
                urlWhitelist: {
                    type: 'object',
                    title: 'URLs enabled for click-to-dial',
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
            urlWhitelist: {
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
            urlWhitelist: {
                customizable: adminUserSettings?.urlWhitelist?.customizable ?? true,
                value: adminUserSettings?.urlWhitelist?.value ?? ''
            }
        }
    }
}

exports.getClickToDialEmbedPageRender = getClickToDialEmbedPageRender;