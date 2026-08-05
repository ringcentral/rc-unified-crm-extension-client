import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

function getPluginFilterLabels(): UnknownRecord {
    return {
        all: t('common.labels.all'),
        private: t('common.labels.private'),
        shared: t('common.labels.sharedWithYou'),
    };
}

function normalizePluginFilter(filter: unknown): string {
    const labels = getPluginFilterLabels();
    switch (filter) {
        case undefined:
        case null:
        case '':
        case 'All':
            return labels.all;
        case 'Private':
            return labels.private;
        case 'Shared':
        case 'Shared With You':
            return labels.shared;
        default:
            return String(filter);
    }
}

function getPluginMarketListPageRender({ pluginList, searchWord = '', filter = null }: UnknownRecord): UnknownRecord {
    const filterLabels = getPluginFilterLabels();
    const filterValue = normalizePluginFilter(filter);
    let pluginListToRender = [];
    for (const plugin of pluginList) {
        let meta = '';
        switch (plugin.access) {
            case 'public':
                meta = '';
                break;
            case 'shared':
                meta = filterLabels.shared;
                break;
            case 'private':
                meta = filterLabels.private;
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
    if (filterValue !== filterLabels.all) {
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
                    filterLabels.all,
                    filterLabels.private,
                    filterLabels.shared
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

export { getPluginMarketListPageRender, normalizePluginFilter };
export default {
    getPluginMarketListPageRender,
};
