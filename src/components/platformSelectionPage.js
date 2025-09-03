function getPlatformSelectionPageRender({ manifest, searchWord = '', selectedPlatform = '', filter = 'All' }) {
    let platformList = [];

    // put the new element as the last element that has the same developer
    // if there's no same developer, put it at the last of the array
    for (const platform of Object.values(manifest.platforms)) {
        const newPlatform = {
            const: platform.name,
            title: platform.displayName,
            icon: platform.logoUrl,
            description: `by ${platform.developer.name}`,
            meta: 'Shared with you',
            actions:[
                {
                    id: 'selectPlatform',
                    title: 'Connect',
                    icon: 'connect'
                }
            ]
        };
        platformList.push(newPlatform);
    }
    if (searchWord) {
        platformList = platformList.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filter !== 'All') {
        platformList = platformList.filter(um => um.meta === filter);
    }
    return {
        id: 'platformSelectionPage',
        title: 'Select platform',
        type: 'page',
        hideBackButton: true,
        schema: {
            type: 'object',
            properties: {
                platformSearch: {
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
                platforms: {
                    type: 'string',
                    title: 'Platforms',
                    oneOf: platformList
                }
            }
        },
        uiSchema: {
            platformSearch: {
                "ui:field": "search",
                "ui:placeholder": "Search with filters...",
                "ui:filters": [
                    "All",
                    "Shared with you",
                    "Private"
                ]
            },
            platforms: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            }
        },
        formData: {
            platforms: selectedPlatform,
            platformSearch: {
                search: searchWord,
                filter: filter
            }
        }
    }
}


exports.getPlatformSelectionPageRender = getPlatformSelectionPageRender;