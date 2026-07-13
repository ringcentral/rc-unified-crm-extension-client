import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

function getPluginAdminConfigurePageRender({ pluginId, pluginAccess, plugin, installed, ownerRcAccountId }: UnknownRecord): UnknownRecord {
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
                            actions: installed ? [
                                { id: 'removeButton', type: 'button', title: t('plugins.uninstall'), variant: 'contained', color: 'danger.b03' }
                            ] : [
                                { id: 'installButton', type: 'button', title: t('plugins.install'), variant: 'contained', color: 'primary' }
                            ]
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
            logTypes: plugin.supportedLogTypes,
            ownerRcAccountId,
        }
    }
    return page;
}

export { getPluginAdminConfigurePageRender };
export default {
    getPluginAdminConfigurePageRender,
};
