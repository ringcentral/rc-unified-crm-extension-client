function getInstalledPluginListPageRender({ viewType, pluginList }) {
    let pluginListToRender = [];
    for (const plugin of pluginList) {
        const newPlugin = {
            const: `${plugin.id}=${plugin.access}`,
            title: plugin.displayName ?? plugin.name,
            icon: plugin.iconUrl ? plugin.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: `by ${plugin.developer.name}`,
            authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
            actions: [
                {
                    id: 'selectPlugin',
                    title: 'Configure',
                    icon: 'connect'
                }
            ]
        };
        pluginListToRender.push(newPlugin);
    }
    const page = {
        id: 'installedPluginListPage',
        title: 'Plugins',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                ...(pluginListToRender.length > 0 ? {
                    plugins: {
                        type: 'string',
                        title: 'Plugins',
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
            viewType
        }
    }
    if (pluginList?.length === 0) {
        page.schema.properties.helperText = {
            type: 'string',
            description: 'No plugin installed'
        };
        page.uiSchema.helperText = {
            "ui:field": "typography",
            "ui:variant": "body1",
        }
    }
    return page;
}
exports.getInstalledPluginListPageRender = getInstalledPluginListPageRender;

