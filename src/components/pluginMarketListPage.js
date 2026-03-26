import { t } from '../i18n';

function getPluginMarketListPageRender({ pluginList, searchWord = '', filter = null }) {
    const allLabel = t('common.labels.all');
    const filterValue = filter ?? allLabel;
    let pluginListToRender = [];
    for (const plugin of pluginList) {
        let meta = '';
        switch (plugin.access) {
            case 'public':
                meta = '';
                break;
            case 'shared':
                meta = t('common.labels.sharedWithYou');
                break;
            case 'private':
                meta = t('common.labels.private');
                break;
        }
        const newPlugin = {
            const: `${plugin.id}=${plugin.access}`,
            title: plugin.displayName ?? plugin.name,
            icon: plugin.iconUrl ? plugin.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: t('plugins.by', { author: plugin.developer.name }),
            meta: meta,
            authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
            actions: [
                {
                    id: 'selectPlugin',
                    title: t('plugins.install'),
                    icon: 'info'
                }
            ]
        };
        pluginListToRender.push(newPlugin);
    }
    if (searchWord) {
        pluginListToRender = pluginListToRender.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filterValue !== allLabel) {
        pluginListToRender = pluginListToRender.filter(um => um.meta === filterValue);
    }
    const page = {
        id: 'pluginMarketListPage',
        title: t('plugins.pluginMarket'),
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                pluginSearch: {
                    type: 'object',
                    properties: {
                        search: {
                            type: 'string',
                            title: t('common.labels.search')
                        },
                        filter: {
                            type: 'string',
                            title: t('common.labels.filter')
                        }
                    }
                },
                plugins: {
                    type: 'string',
                    title: t('plugins.title'),
                    oneOf: pluginListToRender
                }
            }
        },
        uiSchema: {
            pluginSearch: {
                "ui:field": "search",
                "ui:placeholder": t('plugins.searchPlaceholder'),
                "ui:filters": [
                    allLabel,
                    t('common.labels.private'),
                    t('common.labels.sharedWithYou')
                ]
            },
            plugins: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            }
        },
        formData: {
            isFromAdmin: true,
            pluginSearch: {
                search: searchWord,
                filter: filterValue
            },
            pluginList,
        }
    }
    return page;
}
exports.getPluginMarketListPageRender = getPluginMarketListPageRender;

