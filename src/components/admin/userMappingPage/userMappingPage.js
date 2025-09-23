function getUserMappingPageRender({ userMapping, platformDisplayName, searchWord = '', filter = 'All' }) {
    let userMappingList = [];
    for (const um of userMapping) {
        if (um.rcUser?.extensionId && um.rcUser.extensionId !== 'none') {
            userMappingList.push({
                const: um.crmUser.id,
                title: um.crmUser.name,
                description: `${um.rcUser.email || um.rcUser.name}${um.rcUser.extensionNumber ? `, ext: ${um.rcUser.extensionNumber}` : ''}`,
                meta: 'Mapped',
                actions: [
                    {
                        id: 'usermappingEdit',
                        title: 'Edit',
                        icon: 'edit'
                    },
                    {
                        id: 'usermappingRemove',
                        title: 'Remove',
                        icon: 'delete'
                    }
                ]
            })
        }
        else {
            userMappingList.push({
                const: um.crmUser.id,
                title: um.crmUser.name,
                description: '(Unknown)',
                meta: 'Unmapped',
                actions: [
                    {
                        id: 'usermappingEdit',
                        title: 'Edit',
                        icon: 'edit'
                    }
                ]
            })
        }
    }
    if (searchWord) {
        userMappingList = userMappingList.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filter !== 'All') {
        userMappingList = userMappingList.filter(um => um.meta === filter);
    }
    return {
        id: 'userMappingPage',
        title: 'User mapping',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                userSearch: {
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
                userMappingTitle: {
                    type: 'string',
                    description: `${platformDisplayName} Users`
                },
                userMappingList: {
                    type: 'string',
                    title: 'User mapping',
                    oneOf: userMappingList
                }
            }
        },
        uiSchema: {
            userSearch: {
                "ui:field": "search",
                "ui:placeholder": "Search with filters...",
                "ui:filters": [
                    "All",
                    "Unmapped",
                    "Mapped"
                ]
            },
            userMappingList: {
                "ui:field": "list"
            },
            userMappingTitle: {
                "ui:field": "typography",
                "ui:variant": "body2",
            }
        },
        formData: {
            allUserMapping: userMapping,
            userSearch: {
                search: searchWord,
                filter: filter
            }
        }
    }
}

exports.getUserMappingPageRender = getUserMappingPageRender;