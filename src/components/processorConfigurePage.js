function getProcessorConfigurePageRender({ viewType, processorId, processorAccess, processor, activated, isLoggedIn }) {
    const page = {
        id: 'processorConfigurePage',
        title: 'Config',
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
                submitText: viewType === 'explore' ? 'Install' : 'Save',
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
            logType: processor.supportedLogType,
            viewType
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
    if (viewType === 'installed') {
        page.schema.properties.removeButton = {
            type: 'string',
            title: 'Remove',
        }
        page.uiSchema.removeButton = {
            "ui:field": "button",
            "ui:variant": "outlined",
            "ui:color": "danger.b03",
            "ui:fullWidth": true,
        }
    }
    return page;
}

exports.getProcessorConfigurePageRender = getProcessorConfigurePageRender;