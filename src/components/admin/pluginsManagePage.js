import { t } from '../../i18n';

function getPluginsManagePageRender({ adminUserSettings }) {
    const page ={
        id: 'pluginsManagePage',
        title: t('pages.pluginsManage.title'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                section: {
                    type: 'string',
                    oneOf:[
                        {
                            const: 'installedPlugins',
                            title: t('pages.pluginsManage.installedPlugins'),
                        },
                        {
                            const: 'pluginMarket',
                            title: t('pages.pluginsManage.pluginMarket'),
                        }
                    ]
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

exports.getPluginsManagePageRender = getPluginsManagePageRender;