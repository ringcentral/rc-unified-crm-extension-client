function getProcessorListPageRender({ processorList, searchWord = '', filter = 'All' }) {
    let processorListToRender = [];
    for (const processor of processorList) {
        let meta = '';
        switch (processor.access) {
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
        const newProcessor = {
            const: `${processor.id}=${processor.access}`,
            title: processor.displayName ?? processor.name,
            icon: processor.iconUrl ? processor.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: `by ${processor.developer.name}`,
            meta: meta,
            authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
            actions: [
                {
                    id: 'selectProcessor',
                    title: 'Configure',
                    icon: 'connect'
                }
            ]
        };
        processorListToRender.push(newProcessor);
    }
    if (searchWord) {
        processorListToRender = processorListToRender.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filter !== 'All') {
        processorListToRender = processorListToRender.filter(um => um.meta === filter);
    }
    return {
        id: 'processorListPage',
        title: 'Select processor',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                processorSearch: {
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
                processors: {
                    type: 'string',
                    title: 'Processors',
                    oneOf: processorListToRender
                }
            }
        },
        uiSchema: {
            processorSearch: {
                "ui:field": "search",
                "ui:placeholder": "Search with filters...",
                "ui:filters": [
                    "All",
                    "Private",
                    "Shared with you"
                ]
            },
            processors: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            }
        },
        formData: {
            processorSearch: {
                search: searchWord,
                filter: filter
            },
            processorList
        }
    }
}
exports.getProcessorListPageRender = getProcessorListPageRender;