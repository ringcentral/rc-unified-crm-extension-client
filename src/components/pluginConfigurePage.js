function getPluginConfigurePageRender({ viewType, pluginId, pluginAccess, plugin, isAdminOnly, activated, isLoggedIn }) {
    const page = {
        id: 'pluginConfigurePage',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                basicInfo: {
                    type: 'string',
                    title: 'Basic info',
                    oneOf: [
                        {
                            const: 'basicInfo',
                            title: plugin.displayName ?? plugin.name,
                            icon: plugin.iconUrl ?? 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
                            description: `by ${plugin.name.split('.')[0]}`,
                        }
                    ]
                },
                description: {
                    type: 'string',
                    description: plugin.description,
                }
            }
        },
        uiSchema: {
            basicInfo: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false,
                "ui:readonly": true,
                "ui:showSelected": false,
            },
            description: {
                "ui:field": "typography",
                "ui:variant": "body1",
            }
        },
        formData: {
            activated: activated ?? false,
            access: pluginAccess,
            pluginId,
            plugin,
            isAdminOnly,
            isAsync: plugin.isAsync,
            phase: plugin.phase,
            logType: plugin.supportedLogType,
            viewType
        }
    }
    switch (viewType) {
        case 'explore':
            page.schema.properties = {
                ...page.schema.properties,
                isAdminOnly: {
                    type: 'boolean',
                    title: 'Admin only',
                    description: 'This plugin is installed only for admin users.',
                    default: isAdminOnly,
                },
                installButton: {
                    type: 'string',
                    title: 'Install',
                }
            };
            page.uiSchema = {
                ...page.uiSchema,
                installButton: {
                    "ui:field": "button",
                    "ui:variant": "contained",
                    "ui:fullWidth": true,
                }
            };
            break;
        case 'installed':
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
            if (plugin.showAuthorizationButton) {
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
            }
            page.uiSchema.activated = {
                "ui:disabled": !isLoggedIn
            }
            break;
    }
    return page;
}

exports.getPluginConfigurePageRender = getPluginConfigurePageRender;

