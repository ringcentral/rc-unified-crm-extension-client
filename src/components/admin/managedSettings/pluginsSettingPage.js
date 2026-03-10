function getPluginsSettingPageRender({ installedPluginList }) {
    const pluginListToRender = installedPluginList.map(plugin => { return { const: plugin.id, title: plugin.displayName } });
    const page = {
        id: 'pluginAdminSettingsPage',
        title: 'Plugin admin settings',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                section: {
                    type: 'string',
                    oneOf: pluginListToRender
                }
            }
        },
        uiSchema: {
            section: {
                "ui:field": "list",
                "ui:navigation": true,
            }
        }
    }
    return page;
}

exports.getPluginsSettingPageRender = getPluginsSettingPageRender;