import { t } from '../i18n';

function getInstalledPluginListPageRender({ pluginList, isFromAdmin }) {
    let pluginListToRender = [];
    for (const plugin of pluginList) {
        const newPlugin = {
            const: `${plugin.id}=${plugin.access}`,
            title: plugin.displayName ?? plugin.name,
            icon: plugin.iconUrl ? plugin.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: t('plugins.by', { author: plugin.developer.name }),
            authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
            actions: [
                {
                    id: 'selectPlugin',
                    title: t('plugins.configure'),
                    icon: 'connect'
                }
            ]
        };
        pluginListToRender.push(newPlugin);
    }
    const page = {
        id: 'installedPluginListPage',
        title: t('plugins.title'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                ...(pluginListToRender.length > 0 ? {
                    plugins: {
                        type: 'string',
                        title: t('plugins.title'),
                        oneOf: pluginListToRender
                    }
                } : {})
            }
        },
        uiSchema: {
            plugins: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            }
        },
        formData: {
            pluginList,
            isFromAdmin
        }
    }
    if (pluginList?.length === 0) {
        page.schema.properties.helperText = {
            type: 'string',
            description: t('plugins.noPluginInstalled')
        };
        page.uiSchema.helperText = {
            "ui:field": "typography",
            "ui:variant": "body1",
        }
    }
    return page;
}
exports.getInstalledPluginListPageRender = getInstalledPluginListPageRender;

