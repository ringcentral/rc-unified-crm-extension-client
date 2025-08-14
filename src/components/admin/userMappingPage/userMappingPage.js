function getUserMappingPageRender({ userMapping, searchWord = '', filter = 'All' }) {
    let userMappingList = [];
    for (const um of userMapping) {
        if (um.rcUser?.extensionId) {
            userMappingList.push({
                const: um.crmUser.id,
                title: um.crmUser.name,
                description: `Mapped to ${um.rcUser.email} ${um.rcUser.extensionNumber ? `, ext: ${um.rcUser.extensionNumber}` : ''}`,
                meta: '(Click to edit)'
            })
        }
        else {
            userMappingList.push({
                const: um.crmUser.id,
                title: um.crmUser.name,
                description: 'Unmatched',
                meta: '(Click to edit)'
            })
        }
    }
    if (searchWord) {
        userMappingList = userMappingList.filter(um => um.title.toLowerCase().includes(searchWord.toLowerCase()) || um.description.toLowerCase().includes(searchWord.toLowerCase()));
    }
    if (filter !== 'All') {
        userMappingList = userMappingList.filter(um => um.description.startsWith(filter));
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
                    "Mapped",
                    "Unmatched"
                ]
            },
            userMappingList: {
                "ui:field": "list",
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