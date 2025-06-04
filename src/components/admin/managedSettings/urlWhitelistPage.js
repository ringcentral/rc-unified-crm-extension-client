function getUrlWhitelistPageRender({ adminUserSettings }) {
    return {
        id: 'urlWhitelistPage',
        title: 'URL Whitelist',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                urlWhitelist: {
                    type: 'object',
                    title: 'URL Whitelist',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'URL Whitelist (separated by comma)'
                        }
                    }
                }
            }
        },
        uiSchema: {
            urlWhitelist: {
                "ui:collapsible": true,
                value: {
                    "ui:widget": "textarea"
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

exports.getUrlWhitelistPageRender = getUrlWhitelistPageRender;