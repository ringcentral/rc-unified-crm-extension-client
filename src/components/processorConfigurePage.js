function getProcessorConfigurePageRender({ processorId, processor, activated, selectedLogTypes, isLoggedIn }) {
    const page = {
        id: 'processorConfigurePage',
        title: 'Configure processor',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: processor.displayName ?? processor.name,
                },
                description: {
                    type: 'string',
                    description: processor.description,
                },
                supportedLogTypes: {
                    type: 'array',
                    title: 'Supported log types',
                    items: {
                        type: 'string',
                        enum: processor.supportedLogTypes,
                    },
                    uniqueItems: true
                },
                activated: {
                    type: 'boolean',
                    title: 'Activated',
                }
            }
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: 'Save',
            },
            name: {
                "ui:field": "typography",
                "ui:variant": "title1",
            },
            description: {
                "ui:field": "typography",
                "ui:variant": "body1",
            },
            supportedLogTypes: {
                "ui:widget": "checkboxes",
                "ui:options": {
                    "inline": false
                }
            }
        },
        formData: {
            activated: activated ?? false,
            supportedLogTypes: selectedLogTypes ?? [],
            processorId,
            processor,
            isAsync: processor.isAsync,
            phase: processor.phase,
        }
    }
    if (processor.showAuthorizationButton) {
        if (isLoggedIn) {
            page.schema.properties.logoutButton = {
                type: 'string',
                title: 'Logout',
            }
            page.uiSchema.logoutButton = {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true,
                "ui:color": "danger.b03",
            }
        }
        else {
            page.schema.properties.authButton = {
                type: 'string',
                title: 'Connect',
            }
            page.uiSchema.authButton = {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true
            }
        }
    }
    return page;
}

exports.getProcessorConfigurePageRender = getProcessorConfigurePageRender;