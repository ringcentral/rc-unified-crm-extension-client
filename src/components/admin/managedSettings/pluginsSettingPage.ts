type UnknownRecord = Record<string, any>;

function getPluginsSettingPageRender({ installedPluginList }: UnknownRecord): UnknownRecord {
    const pluginListToRender = installedPluginList.map((plugin: UnknownRecord) => { return { const: plugin.id, title: plugin.displayName } });
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

export { getPluginsSettingPageRender };
export default {
    getPluginsSettingPageRender,
};
