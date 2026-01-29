function getProcessorConfigurePageRender({ processorId, processorAccess, processor, activated, isLoggedIn }) {
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
            }
        },
        formData: {
            activated: activated ?? false,
            access: processorAccess,
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
            page.formData.activated = false;
        }

        page.uiSchema.activated = {
            "ui:disabled": !isLoggedIn
        }
    }
    return page;
}

exports.getProcessorConfigurePageRender = getProcessorConfigurePageRender;