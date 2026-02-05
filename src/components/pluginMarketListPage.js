function getPluginMarketListPageRender({ viewType, pluginList, searchWord = '', filter = 'All' }) {
    let pluginListToRender = [];
    for (const plugin of pluginList) {
        let meta = '';
        switch (plugin.access) {
            case 'public':
                meta = '';
                break;
            case 'shared':
                meta = 'Shared with you';
                break;
            case 'private':
                meta = 'Private';
                break;
        }
        const newPlugin = {
            const: `${plugin.id}=${plugin.access}`,
            title: plugin.displayName ?? plugin.name,
            icon: plugin.iconUrl ? plugin.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: `by ${plugin.developer.name}`,
            meta: meta,
            authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
            actions: [
                {
                    id: 'selectPlugin',
                    title: 'Install',
                    icon: 'info'
                }
            ]
        };
        pluginListToRender.push(newPlugin);
    }
    if (searchWord) {
        pluginListToRender = pluginListToRender.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filter !== 'All') {
        pluginListToRender = pluginListToRender.filter(um => um.meta === filter);
    }
    const page = {
        id: 'pluginMarketListPage',
        title: 'Plugin market',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                pluginSearch: {
                    type: 'object',
                    properties: {
                        search: {
                            type: 'string',
                            title: 'Search'
                        },
                        filter: {
                            type: 'string',
                            title: 'Filter'
                        }
                    }
                },
                plugins: {
                    type: 'string',
                    title: 'Plugins',
                    oneOf: pluginListToRender
                }
            }
        },
        uiSchema: {
            pluginSearch: {
                "ui:field": "search",
                "ui:placeholder": "Search with filters...",
                "ui:filters": [
                    "All",
                    "Private",
                    "Shared with you"
                ]
            },
            plugins: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            }
        },
        formData: {
            pluginSearch: {
                search: searchWord,
                filter: filter
            },
            pluginList,
            viewType
        }
    }
    return page;
}
exports.getPluginMarketListPageRender = getPluginMarketListPageRender;

