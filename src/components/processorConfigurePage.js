function getProcessorConfigurePageRender({ processorId, processor, activated, selectedLogTypes }) {
    return {
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
                },
                authButton:{
                    type: 'string',
                    title: 'Auth',
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
            },
            authButton: {
                "ui:field": "button",
                "ui:variant": "contained",
                "ui:fullWidth": true,
            }
        },
        formData: {
            activated: activated ?? false,
            supportedLogTypes: selectedLogTypes ?? [],
            processorId,
            processorName: processor.name,
            isAsync: processor.isAsync,
            phase: processor.phase,
        }
    }
}

exports.getProcessorConfigurePageRender = getProcessorConfigurePageRender;