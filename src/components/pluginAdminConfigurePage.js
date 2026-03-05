import { t } from '../i18n';

function getPluginAdminConfigurePageRender({ pluginId, pluginAccess, plugin, installed}) {
    const page = {
        id: 'pluginConfigurePage',
        title: t('plugins.configurePage'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                basicInfo: {
                    type: 'string',
                    title: t('plugins.basicInfo'),
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
            isFromAdmin: true,
            installed: installed ?? false,
            access: pluginAccess,
            pluginId,
            plugin,
            isAsync: plugin.isAsync,
            phase: plugin.phase,
            logType: plugin.supportedLogType,
        }
    }
    if (installed) {
        page.schema.properties.removeButton = {
            type: 'string',
            title: t('plugins.uninstall'),
        }
        page.uiSchema.removeButton = {
            "ui:field": "button",
            "ui:variant": "outlined",
            "ui:color": "danger.b03",
            "ui:fullWidth": true,
        }
    }
    else {
        page.schema.properties.installButton = {
            type: 'string',
            title: t('plugins.install'),
        }
        page.uiSchema.installButton = {
            "ui:field": "button",
            "ui:variant": "contained",
            "ui:fullWidth": true,
        }
    }
    return page;
}

exports.getPluginAdminConfigurePageRender = getPluginAdminConfigurePageRender;