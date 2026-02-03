function getProcessorListPageRender({ viewType, processorList, searchWord = '', filter = 'All' }) {
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
                    title: viewType === 'installed' ? 'Configure' : 'Install',
                    icon: viewType === 'installed' ? 'connect' : 'newAction'
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
    const page = {
        id: 'processorListPage',
        title: viewType === 'installed' ? 'My processors' : 'Install processor',
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
            processorList,
            viewType
        }
    }
    if (viewType === 'installed') {
        if (processorList?.length === 0) {
            page.schema.properties.helperText = {
                type: 'string',
                description: "Click 'Add' to install a processor"
            }
            page.uiSchema.helperText = {
                "ui:field": "typography",
                "ui:variant": "h5",
                "ui:style": {
                    marginTop: '80px',
                    textAlign: 'center'
                },
            }
        }
        page.uiSchema.submitButtonOptions = {
            submitText: 'Add'
        }
    }
    return page;
}
exports.getProcessorListPageRender = getProcessorListPageRender;